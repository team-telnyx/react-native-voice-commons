import { Observable } from 'rxjs';
import { Platform } from 'react-native';
import { TelnyxConnectionState } from './models/connection-state';
import { Call } from './models/call';
import { TelnyxCallState } from './models/call-state';
import { Config, CredentialConfig, TokenConfig, validateConfig } from './models/config';
import { SessionManager } from './internal/session/session-manager';
import { CallStateController } from './internal/calls/call-state-controller';
import { VoicePnBridge } from './internal/voice-pn-bridge';

const USE_TRICKLE_ICE_STORAGE_KEY = '@use_trickle_ice';
const PUSH_WHEN_ACTIVE_STORAGE_KEY = '@push_when_active';
const MISSED_CALL_NOTIFICATIONS_STORAGE_KEY = '@enable_missed_call_notifications';
const LEGACY_CALLKIT_ANSWER_KEY = '__legacy_callkit_answer__';

interface PendingCallKitAnswer {
  callKitUUIDOrHeaders?: string | Record<string, string>;
  customHeaders: Record<string, string>;
}

/**
 * Configuration options for TelnyxVoipClient
 */
export interface TelnyxVoipClientOptions {
  /** Enable automatic app state management (background/foreground behavior) - default: true */
  enableAppStateManagement?: boolean;

  /** Enable debug logging */
  debug?: boolean;

  /** Enable Trickle ICE for calls created by this client */
  useTrickleIce?: boolean;
}

/**
 * The main public interface for the react-voice-commons module.
 *
 * This class serves as the Façade for the entire module, providing a simplified
 * API that completely hides the underlying complexity. It is the sole entry point
 * for developers using the react-voice-commons package.
 *
 * The TelnyxVoipClient is designed to be state-management agnostic, exposing
 * all observable state via RxJS streams. This allows developers to integrate it
 * into their chosen state management solution naturally.
 */
export class TelnyxVoipClient {
  private readonly _sessionManager: SessionManager;
  private readonly _callStateController: CallStateController;
  private readonly _options: Required<TelnyxVoipClientOptions>;
  private readonly _pendingCallKitAnswers = new Map<string, PendingCallKitAnswer>();
  private _disposed = false;
  private _disposePromise?: Promise<void>;

  /**
   * Check if the app was launched from a push notification.
   *
   * Use this to avoid double-login on cold start. When true, the SDK will
   * handle login internally via the push notification flow, so you should
   * skip your normal auto-login.
   *
   * @returns true if there is pending push notification data indicating a push-launched app
   */
  static async isLaunchedFromPushNotification(): Promise<boolean> {
    try {
      const pendingAction = await VoicePnBridge.getPendingPushAction();
      if (pendingAction?.action) return true;

      const pendingVoipPush = await VoicePnBridge.getPendingVoipPush();
      if (pendingVoipPush) return true;

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Creates a new TelnyxVoipClient instance.
   *
   * @param options Configuration options for the client
   */
  constructor(options: TelnyxVoipClientOptions = {}) {
    this._options = {
      enableAppStateManagement: true,
      debug: false,
      useTrickleIce: false,
      ...options,
    };

    // Initialize core components
    this._sessionManager = new SessionManager();
    this._callStateController = new CallStateController(this._sessionManager);

    // Set up callback to initialize call state controller listeners when client is ready
    this._sessionManager.setOnClientReady(() => {
      console.log(
        '🔧 TelnyxVoipClient: Client ready, initializing call state controller listeners'
      );
      this._flushPendingCallKitAnswers();
      this._callStateController.initializeClientListeners();
    });

    // Clear any tracked calls when the session disconnects, so ghosts
    // don't accumulate across background → foreground reconnect cycles.
    this._sessionManager.setOnDisconnect(() => {
      this._callStateController.clearAllCalls();
    });

    if (this._options.debug) {
      console.log('TelnyxVoipClient initialized with options:', this._options);
    }
  }

  // ========== Observable Streams ==========

  /**
   * Stream of connection state changes.
   *
   * Emits the current status of the connection to the Telnyx backend.
   * Values include connecting, connected, disconnected, and error states.
   * Listen to this to show connection indicators in your UI.
   */
  get connectionState$(): Observable<TelnyxConnectionState> {
    return this._sessionManager.connectionState$;
  }

  /**
   * Stream of all current calls.
   *
   * Emits a list of all current Call objects. Use this for applications
   * that need to support multiple simultaneous calls (e.g., call waiting,
   * conference calls).
   */
  get calls$(): Observable<Call[]> {
    return this._callStateController.calls$;
  }

  /**
   * Stream of the currently active call.
   *
   * A convenience stream that emits the currently active Call object.
   * It emits null when no call is in progress. Ideal for applications
   * that only handle a single call at a time.
   */
  get activeCall$(): Observable<Call | null> {
    return this._callStateController.activeCall$;
  }

  // ========== Synchronous State Access ==========

  /**
   * Current connection state (synchronous access).
   */
  get currentConnectionState(): TelnyxConnectionState {
    return this._sessionManager.currentState;
  }

  /**
   * Current list of calls (synchronous access).
   */
  get currentCalls(): Call[] {
    return this._callStateController.currentCalls;
  }

  /**
   * Current active call (synchronous access).
   */
  get currentActiveCall(): Call | null {
    return this._callStateController.currentActiveCall;
  }

  /**
   * Check if there are any active calls (not in ENDED or FAILED state).
   * Matches TelnyxRTC `hasActiveCalls` property for multi-call support.
   */
  get hasActiveCalls(): boolean {
    return this.currentCalls.some(
      (call) =>
        call.currentState !== TelnyxCallState.ENDED && call.currentState !== TelnyxCallState.FAILED
    );
  }

  /**
   * Access any active call tracked by the client.
   * A call will be accessible until it has ended (transitioned to the ENDED state).
   * This matches the TelnyxRTC `getCall(callId)` method for multi-call support.
   *
   * @param callId The unique identifier of a call.
   * @returns The Call object that matches the requested callId, or null if not found.
   * @example
   * ```typescript
   * const call = voipClient.getCall('some-call-uuid');
   * if (call) {
   *   console.log('Call state:', call.currentState);
   * }
   * ```
   */
  getCall(callId: string): Call | null {
    return this._callStateController.getCall(callId);
  }

  /**
   * Explicitly set the active call for multi-call scenarios.
   * @param callId The ID of the call to mark as active
   */
  setActiveCall(callId: string): void {
    this._throwIfDisposed();
    this._callStateController.setActiveCall(callId);
  }

  /**
   * Clear the explicitly selected active call and return to default selection.
   */
  clearActiveCall(): void {
    this._throwIfDisposed();
    this._callStateController.clearActiveCall();
  }

  /**
   * Swap the current active call with a held call.
   * On iOS this is coordinated through CallKit so native and SDK state stay aligned.
   *
   * @param targetCallId ID of the held call to make active
   */
  async swapCalls(targetCallId: string): Promise<void> {
    this._throwIfDisposed();

    const activeCall = this.currentActiveCall;
    const heldCall = this.getCall(targetCallId);

    if (!activeCall || !heldCall || activeCall.callId === heldCall.callId) {
      throw new Error('An active call and a different held call are required to swap calls');
    }
    if (activeCall.currentState !== TelnyxCallState.ACTIVE) {
      throw new Error(`Cannot swap active call in state: ${activeCall.currentState}`);
    }
    if (heldCall.currentState !== TelnyxCallState.HELD) {
      throw new Error(`Cannot swap target call in state: ${heldCall.currentState}`);
    }

    if (Platform.OS === 'ios') {
      const { callKitCoordinator } = await import('./callkit/callkit-coordinator');
      if (callKitCoordinator.isAvailable()) {
        const success = await callKitCoordinator.swapCallsFromUI(
          activeCall.telnyxCall,
          heldCall.telnyxCall
        );
        if (!success) {
          throw new Error('CallKit failed to swap calls');
        }
        return;
      }
    }

    await activeCall.hold();
    try {
      await heldCall.resume();
      this.setActiveCall(heldCall.callId);
    } catch (error) {
      await activeCall.resume().catch((resumeError) => {
        console.error('Failed to restore active call after swap failure', resumeError);
      });
      throw error;
    }
  }

  /**
   * Current session ID (UUID) for this connection.
   */
  get sessionId(): string {
    return this._sessionManager.sessionId;
  }

  /**
   * Configuration options for this client instance.
   */
  get options(): Required<TelnyxVoipClientOptions> {
    return this._options;
  }

  // ========== Authentication Methods ==========

  /**
   * Connects to the Telnyx platform using credential authentication.
   *
   * @param config The credential configuration containing SIP username and password
   * @returns A Promise that completes when the connection attempt is initiated
   *
   * Listen to connectionState$ to monitor the actual connection status.
   * Credentials are automatically stored for future reconnection.
   */
  async login(config: CredentialConfig): Promise<void> {
    this._throwIfDisposed();

    const errors = validateConfig(config);
    if (errors.length > 0) {
      throw new Error(`Invalid configuration: ${errors.join(', ')}`);
    }

    if (this._options.debug) {
      console.log('TelnyxVoipClient: Logging in with credentials for user:', config.sipUser);
    }

    const loginConfig = await this._withNativeVoipPushToken({
      ...config,
      useTrickleIce: config.useTrickleIce ?? this._options.useTrickleIce,
    });

    // Store credentials for future reconnection
    await this._storeCredentials(loginConfig);

    await this._sessionManager.connectWithCredential(loginConfig);
  }

  /**
   * Connects to the Telnyx platform using token authentication.
   *
   * @param config The token configuration containing the authentication token
   * @returns A Promise that completes when the connection attempt is initiated
   *
   * Listen to connectionState$ to monitor the actual connection status.
   * Token is automatically stored for future reconnection.
   */
  async loginWithToken(config: TokenConfig): Promise<void> {
    this._throwIfDisposed();

    const errors = validateConfig(config);
    if (errors.length > 0) {
      throw new Error(`Invalid configuration: ${errors.join(', ')}`);
    }

    if (this._options.debug) {
      console.log('TelnyxVoipClient: Logging in with token');
    }

    const loginConfig = await this._withNativeVoipPushToken({
      ...config,
      useTrickleIce: config.useTrickleIce ?? this._options.useTrickleIce,
    });

    // Store token for future reconnection
    await this._storeToken(loginConfig);

    await this._sessionManager.connectWithToken(loginConfig);
  }

  /**
   * Disconnects from the Telnyx platform.
   *
   * This method terminates the connection, ends any active calls, and
   * cleans up all related resources.
   */
  async logout(): Promise<void> {
    if (this._disposed) {
      return;
    }

    if (this._options.debug) {
      console.log('TelnyxVoipClient: Logging out');
    }

    await this._sessionManager.disconnect();
  }

  /**
   * Attempts to reconnect using previously stored configuration.
   *
   * This method is used for auto-reconnection scenarios where the app
   * comes back to the foreground and needs to restore the connection.
   *
   * @returns Promise<boolean> - true if reconnection was successful, false otherwise
   */
  async loginFromStoredConfig(): Promise<boolean> {
    this._throwIfDisposed();

    if (this._options.debug) {
      console.log('TelnyxVoipClient: Attempting to login from stored config');
    }

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
      const useTrickleIce =
        storedUseTrickleIce === null ? this._options.useTrickleIce : storedUseTrickleIce === 'true';
      const pushWhenActive = storedPushWhenActive === 'true';
      const enableMissedCallNotifications = storedMissedCallNotifications === 'true';
      const nativePushToken =
        Platform.OS === 'ios' ? (await VoicePnBridge.getVoipToken())?.trim() : null;
      const pushNotificationDeviceToken = nativePushToken || storedPushToken;

      if (nativePushToken && nativePushToken !== storedPushToken) {
        await AsyncStorage.setItem('@push_token', nativePushToken);
      }

      // Check if we have credential-based authentication data
      if (storedUsername && storedPassword) {
        // Create credential config from stored data
        const { createCredentialConfig } = require('./models/config');
        const config = createCredentialConfig(storedUsername, storedPassword, {
          pushNotificationDeviceToken,
          useTrickleIce,
          pushWhenActive,
          enableMissedCallNotifications,
        });

        if (this._options.debug) {
          console.log(
            'TelnyxVoipClient: Reconnecting with stored credentials for user:',
            storedUsername
          );
        }

        await this._sessionManager.connectWithCredential(config);
        return true;
      }

      // Check if we have token-based authentication data
      if (storedCredentialToken) {
        // Create token config from stored data
        const { createTokenConfig } = require('./models/config');
        const config = createTokenConfig(storedCredentialToken, {
          pushNotificationDeviceToken,
          useTrickleIce,
          pushWhenActive,
          enableMissedCallNotifications,
        });

        if (this._options.debug) {
          console.log('TelnyxVoipClient: Reconnecting with stored token');
        }

        await this._sessionManager.connectWithToken(config);
        return true;
      }

      // No stored authentication data found
      if (this._options.debug) {
        console.log('TelnyxVoipClient: No stored credentials or token found');
      }
      return false;
    } catch (error) {
      if (this._options.debug) {
        console.log('TelnyxVoipClient: Failed to login from stored config:', error);
      }
      return false;
    }
  }

  // ========== Call Management Methods ==========

  /**
   * Initiates a new outgoing call.
   *
   * @param destination The destination number or SIP URI to call
   * @param callerName Optional caller name to display
   * @param callerNumber Optional caller ID number
   * @param customHeaders Optional custom headers to include with the call
   * @returns A Promise that completes with the Call object once the invitation has been sent
   *
   * The call's state can be monitored through the returned Call object's streams.
   */
  async newCall(
    destination: string,
    callerName?: string,
    callerNumber?: string,
    customHeaders?: Record<string, string>
  ): Promise<Call> {
    this._throwIfDisposed();

    if (!destination || destination.trim() === '') {
      throw new Error('Destination is required');
    }

    if (this.currentConnectionState !== TelnyxConnectionState.CONNECTED) {
      throw new Error(`Cannot make call when connection state is: ${this.currentConnectionState}`);
    }

    if (this._options.debug) {
      console.log('TelnyxVoipClient: Creating new call to:', destination);
    }

    return await this._callStateController.newCall(
      destination,
      callerName,
      callerNumber,
      customHeaders
    );
  }

  // ========== Push Notification Methods ==========

  /**
   * Handle push notification payload.
   *
   * This is the unified entry point for all push notifications. It intelligently
   * determines whether to show a new incoming call UI or to process an already
   * actioned (accepted/declined) call upon app launch.
   *
   * @param payload The push notification payload
   */
  async handlePushNotification(payload: Record<string, any>): Promise<void> {
    this._throwIfDisposed();

    if (this._options.debug) {
      console.log('TelnyxVoipClient: Handling push notification:', payload);
    }

    try {
      // SessionManager owns the entire push lifecycle: it disposes any prior
      // client, loads stored credentials if needed, and rebuilds the
      // TelnyxRTC bound to THIS push's voice_sdk_id. We deliberately do not
      // fall back to a generic loginFromStoredConfig() here — that would
      // create a parallel client with no voice_sdk_id awareness, which the
      // gateway then has to `punt` once the SessionManager-driven session
      // also registers, dropping the active call.
      await this._sessionManager.handlePushNotification(payload);
    } catch (error) {
      console.error('TelnyxVoipClient: Error handling push notification:', error);
      throw error;
    }
  }

  /**
   * Disables push notifications for the current session.
   *
   * This method sends a request to the Telnyx backend to disable push
   * notifications for the current registered device/session.
   */
  disablePushNotifications(): void {
    this._throwIfDisposed();

    if (this._options.debug) {
      console.log('TelnyxVoipClient: Disabling push notifications');
    }

    this._sessionManager.disablePushNotifications();
  }

  // ========== CallKit Integration Methods ==========

  /**
   * Set a call to connecting state (used for push notification calls when answered via CallKit)
   * @param callId The ID of the call to set to connecting state
   * @internal
   */
  setCallConnecting(callId: string): void {
    this._callStateController.setCallConnecting(callId);
  }

  /**
   * Find a call by its underlying Telnyx call object
   * @param telnyxCall The Telnyx call object to find
   * @internal
   */
  findCallByTelnyxCall(telnyxCall: any): Call | null {
    return this._callStateController.findCallByTelnyxCall(telnyxCall);
  }

  /**
   * Queue an answer action for when the call invite arrives (for CallKit integration)
   * This should be called when the user answers from CallKit before the socket connection is established
   * @param customHeaders Optional custom headers to include with the answer
   */
  queueAnswerFromCallKit(
    callKitUUIDOrHeaders?: string | Record<string, string>,
    customHeaders: Record<string, string> = {}
  ): void {
    this._throwIfDisposed();

    if (this._options.debug) {
      console.log('TelnyxVoipClient: Queuing answer action from CallKit', {
        callKitUUIDOrHeaders,
        customHeaders,
      });
    }

    const telnyxClient = this._sessionManager.telnyxClient;
    if (telnyxClient && typeof (telnyxClient as any).queueAnswerFromCallKit === 'function') {
      (telnyxClient as any).queueAnswerFromCallKit(callKitUUIDOrHeaders, customHeaders);
    } else {
      const normalizedUUID =
        typeof callKitUUIDOrHeaders === 'string' ? callKitUUIDOrHeaders.toLowerCase() : undefined;
      const actionKey = normalizedUUID ?? LEGACY_CALLKIT_ANSWER_KEY;
      let retainedUUIDOrHeaders: string | Record<string, string> | undefined = normalizedUUID;
      if (callKitUUIDOrHeaders && typeof callKitUUIDOrHeaders !== 'string') {
        retainedUUIDOrHeaders = { ...callKitUUIDOrHeaders };
      }

      this._pendingCallKitAnswers.set(actionKey, {
        callKitUUIDOrHeaders: retainedUUIDOrHeaders,
        customHeaders: { ...customHeaders },
      });
    }
  }

  /**
   * Queue an end action for when the call invite arrives (for CallKit integration)
   * This should be called when the user ends from CallKit before the socket connection is established
   */
  queueEndFromCallKit(callKitUUID?: string): void {
    this._throwIfDisposed();

    if (this._options.debug) {
      console.log('TelnyxVoipClient: Queuing end action from CallKit');
    }

    const telnyxClient = this._sessionManager.telnyxClient;
    if (telnyxClient && typeof (telnyxClient as any).queueEndFromCallKit === 'function') {
      (telnyxClient as any).queueEndFromCallKit(callKitUUID);
    } else {
      console.warn(
        'TelnyxVoipClient: TelnyxRTC client not available or method not found for queueEndFromCallKit'
      );
    }
  }

  /**
   * Associate the next push-delivered INVITE with its app-facing CallKit UUID.
   * The underlying signaling call ID remains unchanged.
   * @internal
   */
  setPushNotificationCallKitUUID(callKitUUID: string | null): void {
    const telnyxClient = this._sessionManager.telnyxClient;
    if (
      telnyxClient &&
      typeof (telnyxClient as any).setPushNotificationCallKitUUID === 'function'
    ) {
      (telnyxClient as any).setPushNotificationCallKitUUID(callKitUUID);
    }
  }

  // ========== Lifecycle Methods ==========

  /**
   * Dispose of the client and clean up all resources.
   *
   * After calling this method, the client instance should not be used anymore.
   * This is particularly important for background clients that should be
   * disposed after handling push notifications.
   */
  async dispose(): Promise<void> {
    if (this._disposePromise) {
      return this._disposePromise;
    }

    if (this._options.debug) {
      console.log('TelnyxVoipClient: Disposing client');
    }

    this._disposed = true;
    this._disposePromise = (async () => {
      try {
        await this._sessionManager.dispose();
      } finally {
        this._pendingCallKitAnswers.clear();
        this._callStateController.dispose();
      }
    })();

    return this._disposePromise;
  }

  // ========== Private Methods ==========

  /**
   * Forward answers captured during cold start as soon as SessionManager has
   * created the TelnyxRTC instance. SessionManager invokes its ready callback
   * before connect(), so the UUID-keyed action is present when the INVITE
   * arrives.
   */
  private _flushPendingCallKitAnswers(): void {
    const telnyxClient = this._sessionManager.telnyxClient;
    if (!telnyxClient || typeof (telnyxClient as any).queueAnswerFromCallKit !== 'function') {
      return;
    }

    for (const [actionKey, pendingAnswer] of this._pendingCallKitAnswers) {
      try {
        (telnyxClient as any).queueAnswerFromCallKit(
          pendingAnswer.callKitUUIDOrHeaders,
          pendingAnswer.customHeaders
        );
        this._pendingCallKitAnswers.delete(actionKey);
      } catch (error) {
        console.error('TelnyxVoipClient: Failed to restore pending CallKit answer', {
          actionKey,
          error,
        });
      }
    }
  }

  /**
   * Prefer an explicitly supplied token, otherwise hydrate it from PushKit's
   * native storage. PushKit registration starts in AppDelegate before React
   * mounts, so this removes the race between the JS token event and login.
   */
  private async _withNativeVoipPushToken<T extends Config>(config: T): Promise<T> {
    if (Platform.OS !== 'ios' || config.pushNotificationDeviceToken?.trim()) {
      return config;
    }

    const nativePushToken = (await VoicePnBridge.getVoipToken())?.trim();
    if (!nativePushToken) {
      return config;
    }

    if (this._options.debug) {
      console.log('TelnyxVoipClient: Using PushKit token from native storage');
    }

    return {
      ...config,
      pushNotificationDeviceToken: nativePushToken,
    };
  }

  /**
   * Store credential configuration for automatic reconnection
   */
  private async _storeCredentials(config: CredentialConfig): Promise<void> {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;

      await AsyncStorage.setItem('@telnyx_username', config.sipUser);
      await AsyncStorage.setItem('@telnyx_password', config.sipPassword);
      await AsyncStorage.setItem(
        USE_TRICKLE_ICE_STORAGE_KEY,
        String(config.useTrickleIce ?? false)
      );
      await AsyncStorage.setItem(
        PUSH_WHEN_ACTIVE_STORAGE_KEY,
        String(config.pushWhenActive ?? false)
      );
      await AsyncStorage.setItem(
        MISSED_CALL_NOTIFICATIONS_STORAGE_KEY,
        String(config.enableMissedCallNotifications ?? false)
      );

      if (config.pushNotificationDeviceToken) {
        await AsyncStorage.setItem('@push_token', config.pushNotificationDeviceToken);
      }

      // Clear any existing token since we're using credentials
      await AsyncStorage.removeItem('@credential_token');

      if (this._options.debug) {
        console.log('TelnyxVoipClient: Stored credentials for user:', config.sipUser);
      }
    } catch (error) {
      if (this._options.debug) {
        console.log('TelnyxVoipClient: Failed to store credentials:', error);
      }
      // Don't throw here - storage failure shouldn't prevent login
    }
  }

  /**
   * Store token configuration for automatic reconnection
   */
  private async _storeToken(config: TokenConfig): Promise<void> {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;

      await AsyncStorage.setItem('@credential_token', config.token);
      await AsyncStorage.setItem(
        USE_TRICKLE_ICE_STORAGE_KEY,
        String(config.useTrickleIce ?? false)
      );
      await AsyncStorage.setItem(
        PUSH_WHEN_ACTIVE_STORAGE_KEY,
        String(config.pushWhenActive ?? false)
      );
      await AsyncStorage.setItem(
        MISSED_CALL_NOTIFICATIONS_STORAGE_KEY,
        String(config.enableMissedCallNotifications ?? false)
      );

      if (config.pushNotificationDeviceToken) {
        await AsyncStorage.setItem('@push_token', config.pushNotificationDeviceToken);
      }

      // Clear any existing credentials since we're using token
      await AsyncStorage.removeItem('@telnyx_username');
      await AsyncStorage.removeItem('@telnyx_password');

      if (this._options.debug) {
        console.log('TelnyxVoipClient: Stored authentication token');
      }
    } catch (error) {
      if (this._options.debug) {
        console.log('TelnyxVoipClient: Failed to store token:', error);
      }
      // Don't throw here - storage failure shouldn't prevent login
    }
  }

  /**
   * Throw an error if the client has been disposed
   */
  private _throwIfDisposed(): void {
    if (this._disposed) {
      throw new Error('TelnyxVoipClient has been disposed');
    }
  }
}

// ========== Factory Functions ==========

let _sharedInstance: TelnyxVoipClient | null = null;

/**
 * Create or retrieve the shared TelnyxVoipClient instance.
 *
 * This uses a singleton pattern — calling it multiple times (e.g., inside a
 * React component body) always returns the same instance.  If you need to
 * reset the instance, call `destroyTelnyxVoipClient()` first.
 */
export function createTelnyxVoipClient(options?: TelnyxVoipClientOptions): TelnyxVoipClient {
  if (_sharedInstance) {
    return _sharedInstance;
  }
  _sharedInstance = new TelnyxVoipClient(options);
  return _sharedInstance;
}

/**
 * Destroy the shared TelnyxVoipClient instance.
 *
 * Disposes the current singleton so that a subsequent call to
 * `createTelnyxVoipClient()` will create a fresh instance.
 */
export async function destroyTelnyxVoipClient(): Promise<void> {
  const sharedInstance = _sharedInstance;

  if (sharedInstance) {
    _sharedInstance = null;
    await sharedInstance.dispose();
  }
}

/**
 * Create a new TelnyxVoipClient instance for background push notification handling.
 *
 * Unlike `createTelnyxVoipClient`, this always creates a new instance because
 * background isolates need their own independent client.
 */
export function createBackgroundTelnyxVoipClient(
  options?: TelnyxVoipClientOptions
): TelnyxVoipClient {
  return new TelnyxVoipClient(options);
}
