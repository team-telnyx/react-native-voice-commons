import log from 'loglevel';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  private shouldAttachCall: boolean = false;
  private isFromPush: boolean = false;
  private isReconnecting: boolean = false;
  private lastSessionId: string | null = null; // Store sessid from login response
  private readonly sdkIdentity: SDKIdentity;

  // AsyncStorage key for persisting sessid
  private static readonly SESSID_STORAGE_KEY = '@telnyx_last_sessid';

  constructor(con: Connection, sdkIdentity: SDKIdentity) {
    this.connection = con;
    this.sdkIdentity = sdkIdentity;
    this.connection.addListener('telnyx.socket.message', this.onSocketMessage);
    this.connection.addListener('telnyx.socket.close', this.onSocketClose);
    this.connection.addListener('telnyx.socket.error', this.onSocketError);
    this.clientIsReady = null;
  }

  /**
   * Load previously stored sessid from AsyncStorage
   */
  private async loadPersistedSessionId() {
    try {
      const storedSessid = await AsyncStorage.getItem(LoginHandler.SESSID_STORAGE_KEY);
      if (storedSessid) {
        this.lastSessionId = storedSessid;
        log.debug('[LoginHandler] Loaded persisted sessid:', storedSessid);
      } else {
        log.debug('[LoginHandler] No persisted sessid found');
      }
    } catch (error) {
      log.error('[LoginHandler] Failed to load persisted sessid:', error);
    }
  }

  /**
   * Persist sessid to AsyncStorage
   */
  private async persistSessionId(sessid: string) {
    try {
      await AsyncStorage.setItem(LoginHandler.SESSID_STORAGE_KEY, sessid);
      log.debug('[LoginHandler] Persisted sessid to AsyncStorage:', sessid);
    } catch (error) {
      log.error('[LoginHandler] Failed to persist sessid:', error);
    }
  }

  public setAttachCall(shouldAttach: boolean) {
    this.shouldAttachCall = shouldAttach;
    console.log('[LoginHandler] Set attach call flag to:', shouldAttach);
  }

  public setFromPush(fromPush: boolean) {
    this.isFromPush = fromPush;
    console.log('[LoginHandler] Set from push flag to:', fromPush);
  }

  public setReconnecting(isReconnecting: boolean) {
    this.isReconnecting = isReconnecting;
    console.log('[LoginHandler] Set reconnecting flag to:', isReconnecting);
  }

  public login = async (
    options: ClientOptions,
    onSessionId?: (sessionId: string) => void
  ): Promise<string | null> => {
    // A persisted sessid identifies a previous session. Only a genuine
    // reconnect/reattach may claim that identity; a fresh login must not.
    if (this.isReconnecting) {
      await this.loadPersistedSessionId();
    } else {
      this.lastSessionId = null;
    }

    const message = this.createLoginMessage(options);

    // These flags describe the connection currently being established. They
    // are consumed by the login message so a later attempt cannot inherit
    // push or reattachment metadata from this one.
    this.shouldAttachCall = false;
    this.isFromPush = false;
    this.isReconnecting = false;
    this.clientIsReady = createDeferredPromise<boolean>();

    const resp = await this.connection.sendAndWait(message);
    if (!isLoginSuccessResponse(resp)) {
      log.error('Login failed. Please check your credentials and try again.');
      return null;
    }

    // cancelPendingLogin() clears the deferred promise; a login response that
    // arrives after the connection was cancelled must not revive this attempt.
    if (!this.clientIsReady) {
      log.debug('[LoginHandler] Login response arrived after login was cancelled');
      return null;
    }

    // Store the sessid from login response for future use
    this.lastSessionId = resp.result.sessid;
    onSessionId?.(resp.result.sessid);
    log.debug('[LoginHandler] Stored sessid from login response:', this.lastSessionId);

    // Persist to AsyncStorage for future TelnyxRTC instances
    this.persistSessionId(this.lastSessionId);

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

    return gatewayResponse.result.sessid;
  };

  public cancelPendingLogin(reason = 'Connection closed') {
    if (this.waitingForClientReady) {
      this.clientIsReady.reject(new Error(reason));
    }
    this.waitingForClientReady = false;
    this.clientIsReady = null;
  }

  private createLoginMessage = (options: ClientOptions) => {
    const userVariables = createLoginUserVariables({
      pushDeviceToken: options.pushNotificationDeviceToken,
      pushNotificationProvider: Platform.OS,
      pushNotificationEnvironment: __DEV__ ? 'debug' : 'production',
      pushWhenActive: options.pushWhenActive,
    });

    // Only a genuine reconnect/reattach may reuse an existing session id.
    // Fresh logins start a new session even if an id was persisted earlier.
    const sessid = this.isReconnecting
      ? (options as any).sessid || this.lastSessionId
      : null;
    if (sessid) {
      log.debug('[LoginHandler] Using sessid for reconnection:', sessid);
    } else {
      log.debug('[LoginHandler] No sessid available for this login');
    }

    // A reconnect must ask the gateway to attach the calls that belong to the
    // session it is reclaiming. A push must ask for its own pending call.
    // A fresh login asks for neither.
    const attachCall = this.shouldAttachCall || this.isReconnecting;

    if (options.login && options.password) {
      return createPasswordLoginMessage({
        login: options.login,
        password: options.password,
        reconnection: this.isReconnecting,
        attachCall,
        fromPush: this.isFromPush, // Pass the from push flag
        enableMissedCallNotifications: options.enableMissedCallNotifications ?? false,
        userVariables,
        sessid,
      }, this.sdkIdentity);
    }

    if (options.login_token) {
      return createTokenLoginMessage({
        login_token: options.login_token,
        reconnection: this.isReconnecting,
        attachCall,
        fromPush: this.isFromPush, // Pass the from push flag
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
