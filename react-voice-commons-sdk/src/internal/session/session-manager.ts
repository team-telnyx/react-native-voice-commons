import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import * as TelnyxSDK from '@telnyx/react-native-voice-sdk';
import { REACT_NATIVE_COMMONS_SDK_IDENTITY } from '../sdk-identity';
import { ICE_SERVERS_STORAGE_KEY, parseStoredIceServers } from '../ice-servers-storage';
import {
  SIGNALING_ENVIRONMENT_STORAGE_KEY,
  resolveStoredEnvironment,
} from '../signaling-environment';
import { TelnyxConnectionState } from '../../models/connection-state';
import {
  Config,
  CredentialConfig,
  TelnyxEnvironment,
  TokenConfig,
  isCredentialConfig,
  isTokenConfig,
} from '../../models/config';

const USE_TRICKLE_ICE_STORAGE_KEY = '@use_trickle_ice';
const PUSH_WHEN_ACTIVE_STORAGE_KEY = '@push_when_active';
const MISSED_CALL_NOTIFICATIONS_STORAGE_KEY = '@enable_missed_call_notifications';
const QUALITY_METRICS_STORAGE_KEY = '@enable_quality_metrics';

export interface SessionManagerOptions {
  /** Environment used when a config or stored restore does not specify one */
  defaultEnvironment?: TelnyxEnvironment;
}

/**
 * Manages the connection lifecycle to the Telnyx platform.
 *
 * This class handles authentication, connection state management,
 * and automatic reconnection logic.
 */
export class SessionManager {
  private readonly _connectionState = new BehaviorSubject<TelnyxConnectionState>(
    TelnyxConnectionState.DISCONNECTED
  );
  private _telnyxClient?: TelnyxSDK.TelnyxRTC;
  private _currentConfig?: Config;
  private _sessionId: string;
  private _disposed = false;
  private _disposing = false;
  private _connectionGeneration = 0;
  private _pushRequest = 0;
  private _connectingPush?: Record<string, any>;
  private _disposePromise?: Promise<void>;
  private _connectPromise?: Promise<void>;
  private _onClientReady?: () => void;
  private _onDisconnect?: () => void;
  private readonly _defaultEnvironment: TelnyxEnvironment;

  constructor(options: SessionManagerOptions = {}) {
    this._sessionId = this._generateSessionId();
    this._defaultEnvironment = options.defaultEnvironment ?? 'production';
  }

  /**
   * Observable stream of connection state changes
   */
  get connectionState$(): Observable<TelnyxConnectionState> {
    return this._connectionState.asObservable().pipe(distinctUntilChanged());
  }

  /**
   * Set callback to be called when the Telnyx client is ready
   */
  setOnClientReady(callback: () => void): void {
    this._onClientReady = callback;
  }

  /**
   * Set callback to be called when the session disconnects, so dependent
   * subsystems (e.g. the call state controller) can clear their state.
   */
  setOnDisconnect(callback: () => void): void {
    this._onDisconnect = callback;
  }

  /**
   * Current connection state (synchronous access)
   */
  get currentState(): TelnyxConnectionState {
    return this._connectionState.value;
  }

  /**
   * Current session ID
   */
  get sessionId(): string {
    return this._sessionId;
  }

  /**
   * Get the underlying Telnyx client instance
   */
  get telnyxClient(): TelnyxSDK.TelnyxRTC | undefined {
    return this._telnyxClient;
  }

  get useTrickleIce(): boolean {
    return Boolean(this._currentConfig?.useTrickleIce);
  }

  /**
   * Connect using credential authentication
   */
  async connectWithCredential(config: CredentialConfig): Promise<void> {
    this._assertCanStartConnection();
    this._pushRequest += 1;
    this._currentConfig = config;
    await this._connect();
    this._assertCanStartConnection();
  }

  /**
   * Connect using token authentication
   */
  async connectWithToken(config: TokenConfig): Promise<void> {
    this._assertCanStartConnection();
    this._pushRequest += 1;
    this._currentConfig = config;
    await this._connect();
    this._assertCanStartConnection();
  }

  /**
   * Disconnect from the Telnyx platform.
   *
   * The DISCONNECTED state is emitted BEFORE awaiting the underlying
   * client teardown so that observers (including the auto-reconnect logic
   * in TelnyxVoiceApp) cannot read a stale CONNECTED value during the
   * short window while the socket is being torn down. Tracked calls are
   * cleared here too, since a torn-down socket will never emit the
   * ENDED/FAILED events that normally trigger per-call cleanup.
   */
  async disconnect(): Promise<void> {
    if (this._disposed) {
      return;
    }

    this._connectionGeneration += 1;
    this._pushRequest += 1;
    this._currentConfig = undefined;
    this._connectionState.next(TelnyxConnectionState.DISCONNECTED);

    if (this._onDisconnect) {
      try {
        this._onDisconnect();
      } catch (error) {
        console.error('Error in onDisconnect callback:', error);
      }
    }

    if (this._telnyxClient) {
      await this._disconnectAndForgetClient(this._telnyxClient, 'Error during disconnect:');
    }
  }

  /**
   * Disable push notifications for the current session.
   * Delegates to the TelnyxRTC client's disablePushNotification() method
   * which sends a 'telnyx_rtc.disable_push_notification' message via the socket.
   */
  disablePushNotifications(): void {
    if (
      !this._isTeardownActive() &&
      this._telnyxClient &&
      this.currentState === TelnyxConnectionState.CONNECTED
    ) {
      console.log('SessionManager: Disabling push notifications for session:', this._sessionId);
      this._telnyxClient.disablePushNotification();
    } else {
      console.warn('SessionManager: Cannot disable push - client not connected');
    }
  }

  /**
   * Handle push notification with stored config
   */
  handlePushNotificationWithConfig(pushMetaData: any, config: Config): void {
    if (this._isTeardownActive()) {
      return;
    }

    this._currentConfig = config;
    // Implementation for handling push notifications
    // This would integrate with the actual Telnyx SDK push handling
    console.log('Handling push notification with config:', { pushMetaData, config: config.type });
  }

  /**
   * Handle push notification (async version)
   */
  async handlePushNotification(payload: Record<string, any>): Promise<void> {
    if (this._isTeardownActive()) {
      return;
    }

    const actualPayload = this._extractPushPayload(payload);
    const callId = actualPayload.call_id ?? actualPayload.callId;
    const client = this._telnyxClient;
    const calls = client ? this._getLiveCalls(client) : [];
    const target =
      typeof callId === 'string'
        ? calls.find(
            (call) => (call._callKitUUID ?? call.callId)?.toLowerCase() === callId.toLowerCase()
          )
        : undefined;
    if (target) {
      if (actualPayload.action === 'answer' && target.state === 'ringing') await target.answer();
      if (actualPayload.action === 'reject' && target.state === 'ringing') target.hangup();
      return;
    }

    const connectingPush = this._connectingPush;
    if (
      client &&
      connectingPush &&
      callId &&
      callId === (connectingPush.call_id ?? connectingPush.callId) &&
      actualPayload.voice_sdk_id === connectingPush.voice_sdk_id
    ) {
      if (actualPayload.action === 'answer' || actualPayload.action === 'reject') {
        (client as any).processVoIPNotification(actualPayload);
      }
      return;
    }

    const request = ++this._pushRequest;
    const isCurrent = () => !this._isTeardownActive() && request === this._pushRequest;

    if (client && calls.some((call) => call.state === 'active' || call.state === 'held')) {
      (client as any).processVoIPNotification(actualPayload);
      this._onClientReady?.();
      return;
    }

    if (client) {
      this._connectionGeneration += 1;
      await this._disconnectAndForgetClient(
        client,
        'SessionManager: disconnect of prior client threw:'
      );
    }
    if (!isCurrent()) return;

    // If we don't have a config yet but we're processing a push notification,
    // attempt to load stored config first (for terminated app startup)
    if (!this._currentConfig && !this._telnyxClient) {
      console.log(
        'SessionManager: RELEASE DEBUG - No config available, attempting to load from stored config for push notification'
      );

      try {
        // Try to retrieve stored credentials and token from AsyncStorage
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;

        const storedUsername = await AsyncStorage.getItem('@telnyx_username');
        const storedPassword = await AsyncStorage.getItem('@telnyx_password');
        const storedCredentialToken = await AsyncStorage.getItem('@credential_token');
        const storedPushToken = await AsyncStorage.getItem('@push_token');
        const storedUseTrickleIce = await AsyncStorage.getItem(USE_TRICKLE_ICE_STORAGE_KEY);
        const storedPushWhenActive = await AsyncStorage.getItem(PUSH_WHEN_ACTIVE_STORAGE_KEY);
        const storedMissedCallNotifications = await AsyncStorage.getItem(
          MISSED_CALL_NOTIFICATIONS_STORAGE_KEY
        );
        const storedEnvironment = await AsyncStorage.getItem(SIGNALING_ENVIRONMENT_STORAGE_KEY);
        const storedQualityMetrics = await AsyncStorage.getItem(QUALITY_METRICS_STORAGE_KEY);
        const storedIceServers = await AsyncStorage.getItem(ICE_SERVERS_STORAGE_KEY);
        const iceServers = parseStoredIceServers(storedIceServers);
        const useTrickleIce = storedUseTrickleIce === 'true';
        const pushWhenActive = storedPushWhenActive === 'true';
        const enableMissedCallNotifications = storedMissedCallNotifications === 'true';
        const enableQualityMetrics = storedQualityMetrics === 'true';
        const environment = resolveStoredEnvironment(storedEnvironment, this._defaultEnvironment);

        if (!isCurrent()) {
          return;
        }

        // Check if we have credential-based authentication data
        if (storedUsername && storedPassword) {
          console.log('SessionManager: RELEASE DEBUG - Found stored credentials, creating config');
          const { createCredentialConfig } = require('../../models/config');
          this._currentConfig = createCredentialConfig(storedUsername, storedPassword, {
            pushNotificationDeviceToken: storedPushToken,
            useTrickleIce,
            pushWhenActive,
            enableMissedCallNotifications,
            enableQualityMetrics,
            environment,
            iceServers,
          });
        }
        // Check if we have token-based authentication data
        else if (storedCredentialToken) {
          console.log('SessionManager: RELEASE DEBUG - Found stored token, creating config');
          const { createTokenConfig } = require('../../models/config');
          this._currentConfig = createTokenConfig(storedCredentialToken, {
            pushNotificationDeviceToken: storedPushToken,
            useTrickleIce,
            pushWhenActive,
            enableMissedCallNotifications,
            enableQualityMetrics,
            environment,
            iceServers,
          });
        }

        if (this._currentConfig) {
          console.log(
            'SessionManager: RELEASE DEBUG - Successfully loaded stored config for push notification'
          );
        } else {
          console.log('SessionManager: RELEASE DEBUG - No stored authentication data found');
        }
      } catch (error) {
        console.warn('SessionManager: Failed to load stored config for push notification:', error);
      }
    }

    if (isCurrent() && this._currentConfig) {
      await this._connect({ payload: actualPayload, request });
    }
  }

  private _getLiveCalls(client: TelnyxSDK.TelnyxRTC): any[] {
    const calls =
      typeof (client as any).getActiveCalls === 'function'
        ? (client as any).getActiveCalls()
        : Array.from(((client as any).calls as Map<string, any> | undefined)?.values?.() || []);
    return calls.filter((call: any) => call && call.state !== 'ended');
  }

  /**
   * Dispose of the session manager and clean up resources
   */
  async dispose(): Promise<void> {
    if (this._disposed) {
      return;
    }

    if (!this._disposePromise) {
      this._disposePromise = this._dispose();
    }

    await this._disposePromise;
  }

  /**
   * Internal method to establish connection with or without push notification handling
   */
  private async _connect(push?: { payload: Record<string, any>; request: number }): Promise<void> {
    const previousConnect = this._connectPromise;
    if (previousConnect) {
      try {
        await previousConnect;
      } catch (error) {
        if (this._isTeardownActive()) {
          throw error;
        }
      }
    }

    this._assertCanStartConnection();
    if (push && push.request !== this._pushRequest) return;

    const config = this._currentConfig;
    if (!config) {
      throw new Error('No configuration provided');
    }

    const connectionGeneration = (this._connectionGeneration += 1);
    this._connectingPush = push?.payload;
    const connectPromise = this._runConnect(config, connectionGeneration, push?.payload);
    this._connectPromise = connectPromise;

    try {
      await connectPromise;
    } finally {
      if (this._connectPromise === connectPromise) {
        this._connectPromise = undefined;
        this._connectingPush = undefined;
      }
    }
  }

  private async _dispose(): Promise<void> {
    this._disposing = true;
    this._connectionGeneration += 1;

    const inFlightConnect = this._connectPromise;

    await this.disconnect();

    if (inFlightConnect) {
      try {
        await inFlightConnect;
      } catch {
        // A connect canceled by disposal is expected; the cleanup path runs in _runConnect.
      }
    }

    const client = this._telnyxClient;
    if (client) {
      await this._disconnectAndForgetClient(client, 'Error during dispose disconnect:');
    }

    this._currentConfig = undefined;
    this._disposed = true;
    this._disposing = false;
    this._connectionState.complete();
  }

  private async _runConnect(
    config: Config,
    connectionGeneration: number,
    pushPayload?: Record<string, any>
  ): Promise<void> {
    this._throwIfConnectCanceled(connectionGeneration);
    this._connectionState.next(TelnyxConnectionState.CONNECTING);

    let client: TelnyxSDK.TelnyxRTC | undefined;
    let canceledConnectCleanupCompleted = false;

    try {
      // Clean up existing client
      if (this._telnyxClient) {
        await this._disconnectClient(this._telnyxClient, 'Error during disconnect:');
      }

      this._throwIfConnectCanceled(connectionGeneration);

      // Create new client instance with authentication options
      let clientOptions: TelnyxSDK.ClientOptions;

      if (isCredentialConfig(config)) {
        clientOptions = {
          login: config.sipUser,
          password: config.sipPassword,
          logLevel: config.debug ? 'debug' : 'warn',
          debug: config.debug ?? false,
          pushNotificationDeviceToken: config.pushNotificationDeviceToken,
          pushWhenActive: config.pushWhenActive,
          enableMissedCallNotifications: config.enableMissedCallNotifications ?? false,
          useTrickleIce: config.useTrickleIce,
          environment: config.environment ?? this._defaultEnvironment,
          enableCallReports: config.enableCallReports,
          enableQualityMetrics: config.enableQualityMetrics,
          callReportInterval: config.callReportInterval,
          callReportLogLevel: config.callReportLogLevel,
          callReportMaxLogEntries: config.callReportMaxLogEntries,
          iceServers: config.iceServers,
          sdkName: REACT_NATIVE_COMMONS_SDK_IDENTITY.name,
          sdkVersion: REACT_NATIVE_COMMONS_SDK_IDENTITY.version,
        };
        console.log(
          '🔧 SessionManager: Creating TelnyxRTC with credential config, logLevel:',
          clientOptions.logLevel,
          'pushToken:',
          !!config.pushNotificationDeviceToken
        );
      } else if (isTokenConfig(config)) {
        clientOptions = {
          login_token: config.token,
          logLevel: config.debug ? 'debug' : 'warn',
          debug: config.debug ?? false,
          pushNotificationDeviceToken: config.pushNotificationDeviceToken,
          pushWhenActive: config.pushWhenActive,
          enableMissedCallNotifications: config.enableMissedCallNotifications ?? false,
          useTrickleIce: config.useTrickleIce,
          environment: config.environment ?? this._defaultEnvironment,
          enableCallReports: config.enableCallReports,
          enableQualityMetrics: config.enableQualityMetrics,
          callReportInterval: config.callReportInterval,
          callReportLogLevel: config.callReportLogLevel,
          callReportMaxLogEntries: config.callReportMaxLogEntries,
          iceServers: config.iceServers,
          sdkName: REACT_NATIVE_COMMONS_SDK_IDENTITY.name,
          sdkVersion: REACT_NATIVE_COMMONS_SDK_IDENTITY.version,
        };
        console.log(
          '🔧 SessionManager: Creating TelnyxRTC with token config, logLevel:',
          clientOptions.logLevel,
          'pushToken:',
          !!config.pushNotificationDeviceToken
        );
      } else {
        throw new Error('Invalid configuration type');
      }

      client = new TelnyxSDK.TelnyxRTC(clientOptions);
      this._telnyxClient = client;

      if (pushPayload) {
        (client as any).processVoIPNotification(pushPayload);
      }

      this._setupClientListeners(client);

      // Set up CallStateController listeners immediately after client creation
      // This ensures they're ready before any incoming call events are emitted
      console.log(
        '🔧 SessionManager: Setting up CallStateController listeners before connection...'
      );
      console.log('🔧 SessionManager: _onClientReady callback exists:', !!this._onClientReady);
      if (this._onClientReady) {
        console.log('🔧 SessionManager: Calling _onClientReady callback now...');
        this._onClientReady();
        console.log('🔧 SessionManager: _onClientReady callback completed');
      } else {
        console.log('🔧 SessionManager: No _onClientReady callback found');
      }

      this._throwIfConnectCanceled(connectionGeneration);

      // Connect to the platform AFTER processing push notification
      console.log(
        'SessionManager: RELEASE DEBUG - About to call connect() after processing push notification'
      );
      await client.connect();

      if (this._isConnectCanceled(connectionGeneration)) {
        await this._disconnectAndForgetClient(client, 'Error during dispose disconnect:');
        canceledConnectCleanupCompleted = true;
        throw this._createConnectCanceledError();
      }

      // Notify that client is ready for event listeners
      console.log('🔧 SessionManager: Client connected successfully');
    } catch (error) {
      if (this._isConnectCanceled(connectionGeneration)) {
        if (client && !canceledConnectCleanupCompleted) {
          await this._disconnectAndForgetClient(client, 'Error during dispose disconnect:');
        }
        throw this._createConnectCanceledError();
      }

      console.error('Connection failed:', error);
      if (client) {
        try {
          await this._disconnectAndForgetClient(client, 'Error during failed connect cleanup:');
        } catch (cleanupError) {
          console.error('Error during failed connect cleanup:', cleanupError);
        }
      }
      if (!this._isConnectCanceled(connectionGeneration)) {
        this._connectionState.next(TelnyxConnectionState.ERROR);
      }
      throw error;
    }
  }

  /**
   * Set up event listeners for the Telnyx client
   */
  private _setupClientListeners(client: TelnyxSDK.TelnyxRTC): void {
    if (!client) {
      return;
    }

    client.on('telnyx.client.ready', () => {
      if (this._isTeardownActive() || this._telnyxClient !== client) {
        return;
      }

      console.log('Telnyx client ready');
      this._connectionState.next(TelnyxConnectionState.CONNECTED);

      // Ensure CallStateController listeners are set up when client becomes ready
      // This handles both initial connection and automatic reconnection
      console.log(
        '🔧 SessionManager: Client ready event - reinitializing CallStateController listeners'
      );
      if (this._onClientReady) {
        console.log(
          '🔧 SessionManager: Calling _onClientReady callback from client ready event...'
        );
        this._onClientReady();
        console.log('🔧 SessionManager: _onClientReady callback completed from client ready event');
      } else {
        console.log('🔧 SessionManager: No _onClientReady callback found in client ready event');
      }
    });

    client.on('telnyx.client.error', (error: Error) => {
      if (this._isTeardownActive() || this._telnyxClient !== client) {
        return;
      }

      console.error('Telnyx client error:', error);
      this._connectionState.next(TelnyxConnectionState.ERROR);
    });

    // Note: Socket-level events are not exposed in the current SDK
    // We'll rely on the client-level events for now
  }

  /**
   * Extract the actual payload metadata from wrapped push notification payload
   */
  private _extractPushPayload(payload: Record<string, any>): any {
    let metadata = payload.metadata;
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch {
        metadata = undefined;
      }
    }

    if (!metadata || typeof metadata !== 'object') return payload;
    return {
      ...metadata,
      ...(payload.from_notification !== undefined && {
        from_notification: payload.from_notification,
      }),
      ...(payload.action !== undefined && { action: payload.action }),
    };
  }

  /**
   * Generate a unique session ID
   */
  private _generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private _assertCanStartConnection(): void {
    if (this._isTeardownActive()) {
      throw new Error('SessionManager has been disposed');
    }
  }

  private _isTeardownActive(): boolean {
    return this._disposed || this._disposing;
  }

  private _isConnectCanceled(connectionGeneration: number): boolean {
    return this._isTeardownActive() || this._connectionGeneration !== connectionGeneration;
  }

  private _throwIfConnectCanceled(connectionGeneration: number): void {
    if (this._isConnectCanceled(connectionGeneration)) {
      throw this._createConnectCanceledError();
    }
  }

  private _createConnectCanceledError(): Error {
    return new Error(
      this._isTeardownActive()
        ? 'SessionManager has been disposed'
        : 'SessionManager connection has been canceled'
    );
  }

  private async _disconnectClient(
    client: TelnyxSDK.TelnyxRTC,
    errorMessage: string
  ): Promise<void> {
    try {
      await client.disconnect();
    } catch (error) {
      console.error(errorMessage, error);
      throw error;
    }
  }

  private async _disconnectAndForgetClient(
    client: TelnyxSDK.TelnyxRTC,
    errorMessage: string
  ): Promise<void> {
    await this._disconnectClient(client, errorMessage);
    if (this._telnyxClient === client) {
      this._telnyxClient = undefined;
    }
  }
}
