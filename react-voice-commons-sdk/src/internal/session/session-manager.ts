import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import * as TelnyxSDK from '@telnyx/react-native-voice-sdk';
import * as pkg from '../../../package.json';
import { TelnyxConnectionState } from '../../models/connection-state';
import {
  Config,
  CredentialConfig,
  TokenConfig,
  isCredentialConfig,
  isTokenConfig,
} from '../../models/config';
import { txlog } from '../release-log';

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
  private _onClientReady?: () => void;
  private _onDisconnect?: () => void;

  constructor() {
    this._sessionId = this._generateSessionId();
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

  /**
   * Connect using credential authentication
   */
  async connectWithCredential(config: CredentialConfig): Promise<void> {
    if (this._disposed) {
      throw new Error('SessionManager has been disposed');
    }

    this._currentConfig = config;
    await this._connect();
  }

  /**
   * Connect using token authentication
   */
  async connectWithToken(config: TokenConfig): Promise<void> {
    if (this._disposed) {
      throw new Error('SessionManager has been disposed');
    }

    this._currentConfig = config;
    await this._connect();
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
      try {
        await this._telnyxClient.disconnect();
      } catch (error) {
        console.error('Error during disconnect:', error);
      }
    }
  }

  /**
   * Disable push notifications for the current session.
   * Delegates to the TelnyxRTC client's disablePushNotification() method
   * which sends a 'telnyx_rtc.disable_push_notification' message via the socket.
   */
  disablePushNotifications(): void {
    if (this._telnyxClient && this.currentState === TelnyxConnectionState.CONNECTED) {
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
    if (this._disposed) {
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
    if (this._disposed) {
      return;
    }

    txlog.info(
      'Session',
      `handlePushNotification entry, hasClient=${!!this._telnyxClient} hasConfig=${!!this._currentConfig} state=${this.currentState}`
    );
    try {
      txlog.info('Session', `push payload=${JSON.stringify(payload).slice(0, 500)}`);
    } catch {}

    // Store the push notification payload for when the client is created
    (this as any)._pendingPushPayload = payload;

    // If we have a TelnyxRTC instance but its socket isn't fresh — either not
    // connected at all, or connected but with no traffic for longer than the
    // threshold — dispose it so we go through the full _connect() path below
    // instead of calling processVoIPNotification on a stale client.
    //
    // This handles two cases iOS gives us with the same code path:
    //   1. Terminated-then-cold-launched: a client exists (constructed at
    //      app boot) but its connection was never opened (idleMs=Infinity).
    //   2. Suspended-then-thawed: a client exists with `connected=true`,
    //      but the kernel killed the TLS session during freeze without
    //      notifying the JS WebSocket wrapper, so no error event fired.
    //
    // 30s threshold matches the server's keep-alive ping cadence (~20s),
    // so a live session always remains fresh.
    const STALE_THRESHOLD_MS = 30000;
    if (this._telnyxClient) {
      const client = this._telnyxClient as any;
      const isConnected = !!client.connected;
      const idleMs: number =
        typeof client.connectionIdleMs === 'number' ? client.connectionIdleMs : Infinity;
      const isFresh =
        typeof client.isFresh === 'function' ? client.isFresh(STALE_THRESHOLD_MS) : isConnected;
      txlog.info(
        'Session',
        `freshness check: connected=${isConnected} idleMs=${
          idleMs === Infinity ? 'Inf' : Math.round(idleMs)
        } isFresh=${isFresh} threshold=${STALE_THRESHOLD_MS}ms`
      );
      if (!isFresh) {
        txlog.warn(
          'Session',
          `Client present but NOT fresh (connected=${isConnected} idleMs=${
            idleMs === Infinity ? 'Inf' : Math.round(idleMs)
          }) — disposing to force reconnect with push voice_sdk_id`
        );
        try {
          await this._telnyxClient.disconnect();
        } catch (err: any) {
          txlog.warn('Session', `Disconnect of stale client threw: ${err?.message ?? err}`);
        }
        this._telnyxClient = undefined;
        if (this.currentState !== TelnyxConnectionState.DISCONNECTED) {
          txlog.info(
            'Session',
            `state was ${this.currentState} — forcing DISCONNECTED before reconnect`
          );
          this._connectionState.next(TelnyxConnectionState.DISCONNECTED);
        }
      }
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

        // Check if we have credential-based authentication data
        if (storedUsername && storedPassword) {
          console.log('SessionManager: RELEASE DEBUG - Found stored credentials, creating config');
          const { createCredentialConfig } = require('../../models/config');
          this._currentConfig = createCredentialConfig(storedUsername, storedPassword, {
            pushNotificationDeviceToken: storedPushToken,
          });
        }
        // Check if we have token-based authentication data
        else if (storedCredentialToken) {
          console.log('SessionManager: RELEASE DEBUG - Found stored token, creating config');
          const { createTokenConfig } = require('../../models/config');
          this._currentConfig = createTokenConfig(storedCredentialToken, {
            pushNotificationDeviceToken: storedPushToken,
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

    // If we already have a client, process the push notification immediately
    if (this._telnyxClient) {
      console.log(
        'SessionManager: RELEASE DEBUG - Client available, processing push notification immediately'
      );

      if (typeof (this._telnyxClient as any).processVoIPNotification === 'function') {
        const actualPayload = this._extractPushPayload(payload);
        txlog.info(
          'Session',
          `Calling processVoIPNotification on existing client, voice_sdk_id=${actualPayload?.voice_sdk_id ?? 'MISSING'}`
        );
        (this._telnyxClient as any).processVoIPNotification(actualPayload);
        txlog.info('Session', 'processVoIPNotification called (existing client)');
      } else {
        txlog.error('Session', 'processVoIPNotification NOT available on TelnyxRTC client');
      }

      // Clear the pending payload since it was processed
      (this as any)._pendingPushPayload = null;
    } else {
      txlog.info(
        'Session',
        `No client — will attempt reconnect if config available and state allows (hasConfig=${!!this._currentConfig} state=${this.currentState})`
      );

      if (
        this._currentConfig &&
        (this.currentState === TelnyxConnectionState.DISCONNECTED ||
          this.currentState === TelnyxConnectionState.ERROR)
      ) {
        txlog.info(
          'Session',
          `Triggering _connect() for push, state=${this.currentState} configType=${(this._currentConfig as any).type || 'credential'}`
        );
        try {
          await this._connect();
          txlog.info('Session', '_connect() resolved after push trigger');
        } catch (error: any) {
          txlog.error('Session', `_connect() threw after push trigger: ${error?.message ?? error}`);
        }
      } else {
        txlog.warn(
          'Session',
          `Cannot trigger connect — hasConfig=${!!this._currentConfig} state=${this.currentState}. Push payload stored for later.`
        );
      }
    }

    txlog.info('Session', 'handlePushNotification complete');
  }

  /**
   * Dispose of the session manager and clean up resources
   */
  dispose(): void {
    if (this._disposed) {
      return;
    }

    this._disposed = true;
    this.disconnect();
    this._connectionState.complete();
  }

  /**
   * Internal method to establish connection with or without push notification handling
   */
  private async _connect(): Promise<void> {
    if (!this._currentConfig) {
      throw new Error('No configuration provided');
    }

    this._connectionState.next(TelnyxConnectionState.CONNECTING);

    try {
      // Clean up existing client
      if (this._telnyxClient) {
        await this._telnyxClient.disconnect();
      }

      // Create new client instance with authentication options
      let clientOptions: TelnyxSDK.ClientOptions;

      if (isCredentialConfig(this._currentConfig)) {
        clientOptions = {
          login: this._currentConfig.sipUser,
          password: this._currentConfig.sipPassword,
          logLevel: this._currentConfig.debug ? 'debug' : 'warn',
          debug: this._currentConfig.debug ?? false,
          pushNotificationDeviceToken: this._currentConfig.pushNotificationDeviceToken,
          enableCallReports: this._currentConfig.enableCallReports,
          callReportInterval: this._currentConfig.callReportInterval,
          callReportLogLevel: this._currentConfig.callReportLogLevel,
          callReportMaxLogEntries: this._currentConfig.callReportMaxLogEntries,
          sdkVersion: pkg.version,
        };
        console.log(
          '🔧 SessionManager: Creating TelnyxRTC with credential config, logLevel:',
          clientOptions.logLevel,
          'pushToken:',
          !!this._currentConfig.pushNotificationDeviceToken
        );
      } else if (isTokenConfig(this._currentConfig)) {
        clientOptions = {
          login_token: this._currentConfig.token,
          logLevel: this._currentConfig.debug ? 'debug' : 'warn',
          debug: this._currentConfig.debug ?? false,
          pushNotificationDeviceToken: this._currentConfig.pushNotificationDeviceToken,
          enableCallReports: this._currentConfig.enableCallReports,
          callReportInterval: this._currentConfig.callReportInterval,
          callReportLogLevel: this._currentConfig.callReportLogLevel,
          callReportMaxLogEntries: this._currentConfig.callReportMaxLogEntries,
          sdkVersion: pkg.version,
        };
        console.log(
          '🔧 SessionManager: Creating TelnyxRTC with token config, logLevel:',
          clientOptions.logLevel,
          'pushToken:',
          !!this._currentConfig.pushNotificationDeviceToken
        );
      } else {
        throw new Error('Invalid configuration type');
      }

      this._telnyxClient = new TelnyxSDK.TelnyxRTC(clientOptions);

      // CRITICAL: Process any pending push notification payload BEFORE connecting
      // This ensures voice_sdk_id and other payload variables are set before connect() is called
      const pendingPushPayload = (this as any)._pendingPushPayload;
      if (pendingPushPayload) {
        if (typeof (this._telnyxClient as any).processVoIPNotification === 'function') {
          const actualPayload = this._extractPushPayload(pendingPushPayload);
          txlog.info(
            'Session',
            `processVoIPNotification BEFORE connect, voice_sdk_id=${actualPayload?.voice_sdk_id ?? 'MISSING'} call_id=${actualPayload?.call_id ?? 'MISSING'}`
          );
          (this._telnyxClient as any).processVoIPNotification(actualPayload);
        } else {
          txlog.error('Session', 'processVoIPNotification NOT available on new client');
        }

        // Clear the pending payload
        (this as any)._pendingPushPayload = null;
      } else {
        txlog.info('Session', '_connect: no pending push payload');
      }

      this._setupClientListeners();
      if (this._onClientReady) {
        this._onClientReady();
      }

      // SYNTHETIC REPRO ONLY — set DEBUG_CONNECT_DELAY_MS via globalThis to add
      // an artificial pre-connect delay so the answer-before-INVITE race fires
      // reliably without needing real iOS freeze + slow network. Off by default.
      // Example (in app code or before connect): (globalThis as any).DEBUG_CONNECT_DELAY_MS = 2000;
      const debugDelay = (globalThis as any).DEBUG_CONNECT_DELAY_MS;
      if (typeof debugDelay === 'number' && debugDelay > 0) {
        txlog.warn('Session', `DEBUG_CONNECT_DELAY_MS=${debugDelay} — sleeping before connect()`);
        await new Promise((resolve) => setTimeout(resolve, debugDelay));
      }

      txlog.info('Session', 'Calling telnyxClient.connect() (WebSocket handshake starts here)');
      await this._telnyxClient.connect();
      txlog.info('Session', 'telnyxClient.connect() resolved (awaiting telnyx.client.ready event)');
    } catch (error: any) {
      txlog.error('Session', `connect() failed: ${error?.message ?? error}`);
      this._connectionState.next(TelnyxConnectionState.ERROR);
      throw error;
    }
  }

  /**
   * Set up event listeners for the Telnyx client
   */
  private _setupClientListeners(): void {
    if (!this._telnyxClient) {
      return;
    }

    this._telnyxClient.on('telnyx.client.ready', () => {
      txlog.info(
        'Session',
        'telnyx.client.ready — WebSocket authenticated, CONNECTED. Awaiting INVITE/peer connection.'
      );
      this._connectionState.next(TelnyxConnectionState.CONNECTED);
      if (this._onClientReady) {
        this._onClientReady();
      }
    });

    this._telnyxClient.on('telnyx.client.error', (error: Error) => {
      txlog.error('Session', `telnyx.client.error: ${error?.message ?? error}`);
      this._connectionState.next(TelnyxConnectionState.ERROR);
    });

    // Note: Socket-level events are not exposed in the current SDK
    // We'll rely on the client-level events for now
  }

  /**
   * Extract the actual payload metadata from wrapped push notification payload
   */
  private _extractPushPayload(payload: Record<string, any>): any {
    // The payload might be wrapped, so we need to extract the core metadata
    let actualPayload = payload;

    if (payload.metadata && typeof payload.metadata === 'object') {
      // If there's a metadata wrapper, use that but preserve wrapper-level flags
      actualPayload = payload.metadata;

      // Preserve important flags from the wrapper level
      if (payload.from_notification !== undefined) {
        actualPayload.from_notification = payload.from_notification;
      }
      if (payload.action !== undefined) {
        actualPayload.action = payload.action;
      }

      console.log(
        'SessionManager: RELEASE DEBUG - Using metadata portion of payload with preserved flags:',
        JSON.stringify(actualPayload)
      );
    } else if (payload.action === 'incoming_call' && payload.metadata) {
      // Handle the case where metadata is a string that needs parsing
      try {
        const parsedMetadata =
          typeof payload.metadata === 'string' ? JSON.parse(payload.metadata) : payload.metadata;
        actualPayload = parsedMetadata;

        // Preserve important flags from the wrapper level
        if (payload.from_notification !== undefined) {
          actualPayload.from_notification = payload.from_notification;
        }
        if (payload.action !== undefined) {
          actualPayload.action = payload.action;
        }

        console.log(
          'SessionManager: RELEASE DEBUG - Using parsed metadata with preserved flags:',
          JSON.stringify(actualPayload)
        );
      } catch (error) {
        console.warn('SessionManager: Failed to parse metadata:', error);
      }
    }

    return actualPayload;
  }

  /**
   * Generate a unique session ID
   */
  private _generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
