import { Observable } from 'rxjs';
import * as TelnyxSDK from '@telnyx/react-native-voice-sdk';
import { TelnyxConnectionState } from '../../models/connection-state';
import { Config, CredentialConfig, TokenConfig } from '../../models/config';
/**
 * Manages the connection lifecycle to the Telnyx platform.
 *
 * This class handles authentication, connection state management,
 * and automatic reconnection logic.
 */
export declare class SessionManager {
  private readonly _connectionState;
  private _telnyxClient?;
  private _currentConfig?;
  private _sessionId;
  private _disposed;
  private _onClientReady?;
  constructor();
  /**
   * Observable stream of connection state changes
   */
  get connectionState$(): Observable<TelnyxConnectionState>;
  /**
   * Set callback to be called when the Telnyx client is ready
   */
  setOnClientReady(callback: () => void): void;
  /**
   * Current connection state (synchronous access)
   */
  get currentState(): TelnyxConnectionState;
  /**
   * Current session ID
   */
  get sessionId(): string;
  /**
   * Get the underlying Telnyx client instance
   */
  get telnyxClient(): TelnyxSDK.TelnyxRTC | undefined;
  /**
   * Connect using credential authentication
   */
  connectWithCredential(config: CredentialConfig): Promise<void>;
  /**
   * Connect using token authentication
   */
  connectWithToken(config: TokenConfig): Promise<void>;
  /**
   * Disconnect from the Telnyx platform
   */
  disconnect(): Promise<void>;
  /**
   * Disable push notifications for the current session
   */
  disablePushNotifications(): void;
  /**
   * Handle push notification with stored config
   */
  handlePushNotificationWithConfig(pushMetaData: any, config: Config): void;
  /**
   * Handle push notification (async version)
   */
  handlePushNotification(payload: Record<string, any>): Promise<void>;
  /**
   * Dispose of the session manager and clean up resources
   */
  dispose(): void;
  /**
   * Internal method to establish connection with or without push notification handling
   */
  private _connect;
  /**
   * Set up event listeners for the Telnyx client
   */
  private _setupClientListeners;
  /**
   * Extract the actual payload metadata from wrapped push notification payload
   */
  private _extractPushPayload;
  /**
   * Generate a unique session ID
   */
  private _generateSessionId;
}
