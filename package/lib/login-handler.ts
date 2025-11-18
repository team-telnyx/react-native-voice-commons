import log from 'loglevel';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  private lastSessionId: string | null = null; // Store sessid from login response
  
  // AsyncStorage key for persisting sessid
  private static readonly SESSID_STORAGE_KEY = '@telnyx_last_sessid';

  constructor(con: Connection) {
    this.connection = con;
    this.connection.addListener('telnyx.socket.message', this.onSocketMessage);
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

  public login = async (options: ClientOptions): Promise<string | null> => {
    // Ensure sessid is loaded before creating login message
    await this.loadPersistedSessionId();
    
    const message = this.createLoginMessage(options);
    this.clientIsReady = createDeferredPromise<boolean>();

    const resp = await this.connection.sendAndWait(message);
    if (!isLoginSuccessResponse(resp)) {
      log.error('Login failed. Please check your credentials and try again.');
      return null;
    }

    // Store the sessid from login response for future use
    this.lastSessionId = resp.result.sessid;
    log.debug('[LoginHandler] Stored sessid from login response:', this.lastSessionId);
    
    // Persist to AsyncStorage for future TelnyxRTC instances
    this.persistSessionId(this.lastSessionId);

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

    // Use stored sessid from previous login response, or from options if provided
    const sessid = (options as any).sessid || this.lastSessionId;
    if (sessid) {
      log.debug('[LoginHandler] Using sessid for login:', sessid);
    } else {
      log.debug('[LoginHandler] No sessid available for this login');
    }

    if (options.login && options.password) {
      return createPasswordLoginMessage({
        login: options.login,
        password: options.password,
        attachCall: true, // Always include attach_call for reliable reconnection
        fromPush: this.isFromPush, // Pass the from push flag
        userVariables,
        sessid,
      });
    }

    if (options.login_token) {
      return createTokenLoginMessage({
        login_token: options.login_token,
        attachCall: true, // Always include attach_call for reliable reconnection
        fromPush: this.isFromPush, // Pass the from push flag
        userVariables,
        sessid,
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
 