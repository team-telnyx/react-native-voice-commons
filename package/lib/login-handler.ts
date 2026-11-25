import log from 'loglevel';
import { Platform } from 'react-native';
import type { ClientOptions } from './client-options';
import type { SDKIdentity } from './env';
import { Connection } from './connection';
import {
  createGetGatewayStateMessage,
  isClientReadyEvent,
  isValidGatewayStateResponse,
} from './messages/gateway';
import { updateCallReportId } from './global';
import {
  createPasswordLoginMessage,
  createTokenLoginMessage,
  createLoginUserVariables,
  isLoginSuccessResponse,
} from './messages/login';
import { createDeferredPromise } from './promise';
import type { DeferredPromise } from './promise';
export class LoginHandler {
  private connection: Connection;
  private clientIsReady: DeferredPromise<boolean> | null;
  private waitingForClientReady: boolean = false;
  private readonly sdkIdentity: SDKIdentity;

  constructor(con: Connection, sdkIdentity: SDKIdentity) {
    this.connection = con;
    this.sdkIdentity = sdkIdentity;
    this.connection.addListener('telnyx.socket.message', this.onSocketMessage);
    this.connection.addListener('telnyx.socket.close', this.onSocketClose);
    this.connection.addListener('telnyx.socket.error', this.onSocketError);
    this.clientIsReady = null;
  }

  public login = async (
    options: ClientOptions,
    onSessionId?: (sessionId: string, voiceSDKId?: string) => void,
    { fromPush = false, sessionId }: { fromPush?: boolean; sessionId?: string } = {}
  ): Promise<{ id: string; voiceSDKId?: string } | null> => {
    const message = this.createLoginMessage(options, fromPush, sessionId);
    this.clientIsReady = createDeferredPromise<boolean>();

    const resp = await this.connection.sendAndWait(message);
    if (!isLoginSuccessResponse(resp)) {
      log.error('Login failed. Please check your credentials and try again.');
      return null;
    }

    if (!this.clientIsReady) {
      throw new Error('Login canceled');
    }

    onSessionId?.(resp.result.sessid, resp.voice_sdk_id);

    this.waitingForClientReady = true;
    try {
      await this.clientIsReady.promise;
    } finally {
      this.waitingForClientReady = false;
    }

    const gatewayResponse = await this.connection.sendAndWait(createGetGatewayStateMessage());
    if (!isValidGatewayStateResponse(gatewayResponse)) {
      log.error('Invalid gateway state response');
      return null;
    }

    // Capture call_report_id from REGED params for call report authentication
    const callReportId = gatewayResponse.result?.params?.call_report_id;
    if (callReportId) {
      updateCallReportId(callReportId);
      log.debug('[LoginHandler] Captured call_report_id from REGED:', callReportId);
    } else {
      log.warn('[LoginHandler] No call_report_id found in REGED params');
    }

    const registeredRoute = gatewayResponse.voice_sdk_id;
    return {
      id: gatewayResponse.result.sessid,
      voiceSDKId:
        typeof registeredRoute === 'string' && registeredRoute
          ? registeredRoute
          : resp.voice_sdk_id,
    };
  };

  public cancelPendingLogin(reason = 'Connection closed') {
    if (this.waitingForClientReady) {
      this.clientIsReady.reject(new Error(reason));
    }
    this.waitingForClientReady = false;
    this.clientIsReady = null;
  }

  private createLoginMessage = (options: ClientOptions, fromPush: boolean, sessid?: string) => {
    const userVariables = createLoginUserVariables({
      pushDeviceToken: options.pushNotificationDeviceToken,
      pushNotificationProvider: Platform.OS,
      pushNotificationEnvironment: __DEV__ ? 'debug' : 'production',
      pushWhenActive: options.pushWhenActive,
    });

    if (options.login && options.password) {
      return createPasswordLoginMessage({
        login: options.login,
        password: options.password,
        attachCall: fromPush || Boolean(sessid),
        reconnection: Boolean(sessid),
        fromPush,
        enableMissedCallNotifications: options.enableMissedCallNotifications ?? false,
        userVariables,
        sessid,
      }, this.sdkIdentity);
    }

    if (options.login_token) {
      return createTokenLoginMessage({
        login_token: options.login_token,
        attachCall: fromPush || Boolean(sessid),
        reconnection: Boolean(sessid),
        fromPush,
        enableMissedCallNotifications: options.enableMissedCallNotifications ?? false,
        userVariables,
        sessid,
      }, this.sdkIdentity);
    }
    throw new Error(
      'Login credentials are required. Please provide either login and password or a login token.'
    );
  };

  private onSocketMessage = (msg: unknown) => {
    if (isClientReadyEvent(msg)) {
      this.clientIsReady?.resolve(true);
    }
  };

  private onSocketClose = () => {
    this.cancelPendingLogin('Connection closed');
  };

  private onSocketError = () => {
    this.cancelPendingLogin('Connection error');
  };
}
