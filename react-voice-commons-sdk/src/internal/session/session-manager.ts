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
    this._currentConfig = config;
    await this._connect();
    this._assertCanStartConnection();
  }

  /**
   * Connect using token authentication
   */
  async connectWithToken(config: TokenConfig): Promise<void> {
    this._assertCanStartConnection();
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

    console.log(
      'SessionManager: RELEASE DEBUG - Processing push notification, payload:',
      JSON.stringify(payload)
    );

    // A second-call push must stay on the client that owns a call already in
    // progress. Tearing it down destroys the first signaling session and
    // clears the call collection before CallKit can complete Hold & Accept,
    // answer the invite, or finish an in-flight call.
    if (this._telnyxClient && this._hasLiveCall(this._telnyxClient)) {
      const actualPayload = this._extractPushPayload(payload);
      const processVoIPNotification = (this._telnyxClient as any).processVoIPNotification;

      if (typeof processVoIPNotification !== 'function') {
        throw new Error('TelnyxRTC client cannot process an active-call VoIP notification');
      }

      console.log(
        'SessionManager: Preserving active client while processing second-call push notification'
      );
      processVoIPNotification.call(this._telnyxClient, actualPayload);
      return;
    }

    // The cold/no-active-call path still rebuilds the client so the socket is
    // stamped with the push voice_sdk_id before connecting.
    if (this._telnyxClient) {
      await this._disconnectAndForgetClient(
        this._telnyxClient,
        'SessionManager: disconnect of prior client threw:'
      );
    }

    if (this._isTeardownActive()) {
      return;
    }

    if (this.currentState !== TelnyxConnectionState.DISCONNECTED) {
      this._connectionState.next(TelnyxConnectionState.DISCONNECTED);
    }

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

        if (this._isTeardownActive()) {
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

    if (this._isTeardownActive()) {
      return;
    }

    // If we already have a client, process the push notification immediately
    if (this._telnyxClient) {
      console.log(
        'SessionManager: RELEASE DEBUG - Client available, processing push notification immediately'
      );

      // Use type assertion to access the processVoIPNotification method
      // This method sets the isCallFromPush flag which is needed for proper push handling
      if (typeof (this._telnyxClient as any).processVoIPNotification === 'function') {
        console.log(
          'SessionManager: RELEASE DEBUG - Calling processVoIPNotification with payload:',
          JSON.stringify(payload)
        );

        // Extract the actual push notification metadata that the client expects
        const actualPayload = this._extractPushPayload(payload);

        (this._telnyxClient as any).processVoIPNotification(actualPayload);
        console.log('SessionManager: RELEASE DEBUG - Called processVoIPNotification successfully');
      } else {
        console.warn(
          'SessionManager: processVoIPNotification method not available on TelnyxRTC client'
        );
      }
    } else {
      console.log(
        'SessionManager: RELEASE DEBUG - No client available, checking if we can trigger immediate connection'
      );

      // If we have config (either existing or newly loaded from storage) and
      // are not currently connected/connecting, trigger immediate connection.
      // We accept DISCONNECTED and ERROR (a socket failure bumps state to
      // ERROR) so a push after a failed session still re-establishes the
      // connection. The push payload is handed to this connection directly so
      // it cannot be replaced by a later push before the client is created.
      if (
        this._currentConfig &&
        (this.currentState === TelnyxConnectionState.DISCONNECTED ||
          this.currentState === TelnyxConnectionState.ERROR)
      ) {
        console.log(
          'SessionManager: RELEASE DEBUG - Triggering immediate connection for push notification with config type:',
          (this._currentConfig as any).type || 'credential'
        );
        try {
          await this._connect(payload);
          if (this._isTeardownActive()) {
            return;
          }
          console.log(
            'SessionManager: RELEASE DEBUG - Successfully connected after push notification trigger'
          );
        } catch (error) {
          if (this._isTeardownActive()) {
            return;
          }
          console.error(
            'SessionManager: Failed to connect after push notification trigger:',
            error
          );
        }
      } else {
        console.log(
          'SessionManager: RELEASE DEBUG - Cannot trigger connection, config available:',
          !!this._currentConfig,
          'current state:',
          this.currentState
        );
        console.log(
          'SessionManager: RELEASE DEBUG - Push payload not retained: no connection can be established for it. A later fresh login must not inherit its metadata.'
        );
      }
    }

    console.log('SessionManager: RELEASE DEBUG - Push notification handling complete');
  }

  private _hasLiveCall(client: TelnyxSDK.TelnyxRTC): boolean {
    const calls =
      typeof (client as any).getActiveCalls === 'function'
        ? (client as any).getActiveCalls()
        : Array.from(((client as any).calls as Map<string, any> | undefined)?.values?.() || []);

    // Any non-ended call (ringing, connecting, active, held) is a flow that
    // this client owns. A later push must not dispose that client and clear
    // the flow's state.
    return calls.some((call: any) => call?.state !== 'ended');
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
   * Internal method to establish connection with or without push notification handling.
   *
   * `pushPayload` is owned by this specific connection attempt. Passing it
   * explicitly (instead of through a shared field) keeps sequential pushes
   * from consuming each other's metadata.
   */
  private async _connect(pushPayload?: Record<string, any>): Promise<void> {
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

    const config = this._currentConfig;
    if (!config) {
      throw new Error('No configuration provided');
    }

    const connectionGeneration = (this._connectionGeneration += 1);
    const connectPromise = this._runConnect(config, connectionGeneration, pushPayload);
    this._connectPromise = connectPromise;

    try {
      await connectPromise;
    } finally {
      if (this._connectPromise === connectPromise) {
        this._connectPromise = undefined;
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

      // CRITICAL: Process this connection's push notification payload BEFORE
      // connecting. This ensures voice_sdk_id and other payload variables are
      // set before connect() is called. The payload belongs to this attempt
      // only; a later push cannot replace it.
      if (pushPayload) {
        console.log(
          'SessionManager: RELEASE DEBUG - Processing push notification for this connection BEFORE connect:',
          JSON.stringify(pushPayload)
        );

        if (typeof (this._telnyxClient as any).processVoIPNotification === 'function') {
          console.log(
            'SessionManager: RELEASE DEBUG - Calling processVoIPNotification BEFORE connect to set voice_sdk_id'
          );

          // Extract the actual push notification metadata that the client expects
          const actualPayload = this._extractPushPayload(pushPayload);

          (this._telnyxClient as any).processVoIPNotification(actualPayload);
          console.log(
            'SessionManager: RELEASE DEBUG - Successfully processed push notification before connect'
          );
        } else {
          console.warn(
            'SessionManager: processVoIPNotification method not available on new client'
          );
        }
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
      this._connectionState.next(TelnyxConnectionState.ERROR);
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
   * Extract the actual payload metadata from wrapped push notification payload.
   *
   * Returns a copy: the caller's payload object is shared with native bridge
   * consumers and may be processed again (for example when a push is
   * re-delivered), so wrapper flags must not be written into its metadata.
   */
  private _extractPushPayload(payload: Record<string, any>): any {
    const copyWithWrapperFlags = (metadata: Record<string, any>) => {
      const actualPayload = { ...metadata };

      // Preserve important flags from the wrapper level
      if (payload.from_notification !== undefined) {
        actualPayload.from_notification = payload.from_notification;
      }
      if (payload.action !== undefined) {
        actualPayload.action = payload.action;
      }

      return actualPayload;
    };

    if (payload.metadata && typeof payload.metadata === 'object') {
      const actualPayload = copyWithWrapperFlags(payload.metadata);
      console.log(
        'SessionManager: RELEASE DEBUG - Using metadata portion of payload with preserved flags:',
        JSON.stringify(actualPayload)
      );
      return actualPayload;
    }

    // Some push providers deliver metadata as a JSON string. Parse it for any
    // action so a push answer/reject keeps its call_id and voice_sdk_id.
    if (typeof payload.metadata === 'string') {
      try {
        const parsedMetadata = JSON.parse(payload.metadata);
        if (parsedMetadata && typeof parsedMetadata === 'object') {
          const actualPayload = copyWithWrapperFlags(parsedMetadata);
          console.log(
            'SessionManager: RELEASE DEBUG - Using parsed metadata with preserved flags:',
            JSON.stringify(actualPayload)
          );
          return actualPayload;
        }
      } catch (error) {
        console.warn('SessionManager: Failed to parse metadata:', error);
      }
    }

    return payload;
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
