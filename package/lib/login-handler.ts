import log from 'loglevel';
import { Platform } from 'react-native';
import type { ClientOptions } from './client-options';
import { Connection } from './connection';
import {
  createGetGatewayStateMessage,
  isClientReadyEvent,
  isValidGatewayStateResponse,
} from './messages/gateway';
import {
  createPasswordLoginMessage,
  createTokenLoginMessage,
  isLoginSuccessResponse,
} from './messages/login';
import { createDeferredPromise } from './promise';
import type { DeferredPromise } from './promise';
export class LoginHandler {
  private connection: Connection;
  private clientIsReady: DeferredPromise<boolean> | null;
  private shouldAttachCall: boolean = false;
  private isFromPush: boolean = false;

  constructor(con: Connection) {
    this.connection = con;
    this.connection.addListener('telnyx.socket.message', this.onSocketMessage);
    this.clientIsReady = null;
  }

  public setAttachCall(shouldAttach: boolean) {
    this.shouldAttachCall = shouldAttach;
    console.log('[LoginHandler] Set attach call flag to:', shouldAttach);
  }

  public setFromPush(fromPush: boolean) {
    this.isFromPush = fromPush;
    console.log('[LoginHandler] Set from push flag to:', fromPush);
  }

  public login = async (options: ClientOptions): Promise<string | null> => {
    const message = this.createLoginMessage(options);
    this.clientIsReady = createDeferredPromise<boolean>();

    const resp = await this.connection.sendAndWait(message);
    if (!isLoginSuccessResponse(resp)) {
      log.error('Login failed. Please check your credentials and try again.');
      return null;
    }

    await this.clientIsReady.promise;

    const gatewayResponse = await this.connection.sendAndWait(createGetGatewayStateMessage());
    if (!isValidGatewayStateResponse(gatewayResponse)) {
      log.error('Invalid gateway state response');
      return null;
    }

    return gatewayResponse.result.sessid;
  };

  private createLoginMessage = (options: ClientOptions) => {
    const userVariables = {
      push_device_token: options.pushNotificationDeviceToken,
      push_notification_provider: Platform.OS,
      push_notification_environment: __DEV__ ? 'debug' : 'production',
    };

    if (options.login && options.password) {
      return createPasswordLoginMessage({
        login: options.login,
        password: options.password,
        reconnection: false,
        attachCall: this.shouldAttachCall, // Pass the attach call flag
        fromPush: this.isFromPush, // Pass the from push flag
        userVariables,
      });
    }

    if (options.login_token) {
      return createTokenLoginMessage({
        login_token: options.login_token,
        reconnection: false,
        attachCall: this.shouldAttachCall, // Pass the attach call flag
        fromPush: this.isFromPush, // Pass the from push flag
        userVariables,
      });
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
}
