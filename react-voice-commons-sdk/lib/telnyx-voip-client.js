"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelnyxVoipClient = void 0;
exports.createTelnyxVoipClient = createTelnyxVoipClient;
exports.createBackgroundTelnyxVoipClient = createBackgroundTelnyxVoipClient;
const connection_state_1 = require("./models/connection-state");
const config_1 = require("./models/config");
const session_manager_1 = require("./internal/session/session-manager");
const call_state_controller_1 = require("./internal/calls/call-state-controller");
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
class TelnyxVoipClient {
    /**
     * Creates a new TelnyxVoipClient instance.
     *
     * @param options Configuration options for the client
     */
    constructor(options = {}) {
        this._disposed = false;
        this._options = {
            enableAppStateManagement: true,
            debug: false,
            ...options,
        };
        // Initialize core components
        this._sessionManager = new session_manager_1.SessionManager();
        this._callStateController = new call_state_controller_1.CallStateController(this._sessionManager);
        // Set up callback to initialize call state controller listeners when client is ready
        this._sessionManager.setOnClientReady(() => {
            console.log('🔧 TelnyxVoipClient: Client ready, initializing call state controller listeners');
            this._callStateController.initializeClientListeners();
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
    get connectionState$() {
        return this._sessionManager.connectionState$;
    }
    /**
     * Stream of all current calls.
     *
     * Emits a list of all current Call objects. Use this for applications
     * that need to support multiple simultaneous calls (e.g., call waiting,
     * conference calls).
     */
    get calls$() {
        return this._callStateController.calls$;
    }
    /**
     * Stream of the currently active call.
     *
     * A convenience stream that emits the currently active Call object.
     * It emits null when no call is in progress. Ideal for applications
     * that only handle a single call at a time.
     */
    get activeCall$() {
        return this._callStateController.activeCall$;
    }
    // ========== Synchronous State Access ==========
    /**
     * Current connection state (synchronous access).
     */
    get currentConnectionState() {
        return this._sessionManager.currentState;
    }
    /**
     * Current list of calls (synchronous access).
     */
    get currentCalls() {
        return this._callStateController.currentCalls;
    }
    /**
     * Current active call (synchronous access).
     */
    get currentActiveCall() {
        return this._callStateController.currentActiveCall;
    }
    /**
     * Current session ID (UUID) for this connection.
     */
    get sessionId() {
        return this._sessionManager.sessionId;
    }
    /**
     * Configuration options for this client instance.
     */
    get options() {
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
     */
    async login(config) {
        this._throwIfDisposed();
        const errors = (0, config_1.validateConfig)(config);
        if (errors.length > 0) {
            throw new Error(`Invalid configuration: ${errors.join(', ')}`);
        }
        if (this._options.debug) {
            console.log('TelnyxVoipClient: Logging in with credentials for user:', config.sipUser);
        }
        await this._sessionManager.connectWithCredential(config);
    }
    /**
     * Connects to the Telnyx platform using token authentication.
     *
     * @param config The token configuration containing the authentication token
     * @returns A Promise that completes when the connection attempt is initiated
     *
     * Listen to connectionState$ to monitor the actual connection status.
     */
    async loginWithToken(config) {
        this._throwIfDisposed();
        const errors = (0, config_1.validateConfig)(config);
        if (errors.length > 0) {
            throw new Error(`Invalid configuration: ${errors.join(', ')}`);
        }
        if (this._options.debug) {
            console.log('TelnyxVoipClient: Logging in with token');
        }
        await this._sessionManager.connectWithToken(config);
    }
    /**
     * Disconnects from the Telnyx platform.
     *
     * This method terminates the connection, ends any active calls, and
     * cleans up all related resources.
     */
    async logout() {
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
    async loginFromStoredConfig() {
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
            // Check if we have credential-based authentication data
            if (storedUsername && storedPassword) {
                // Create credential config from stored data
                const { createCredentialConfig } = require('./models/config');
                const config = createCredentialConfig(storedUsername, storedPassword, {
                    pushNotificationDeviceToken: storedPushToken,
                });
                if (this._options.debug) {
                    console.log('TelnyxVoipClient: Reconnecting with stored credentials for user:', storedUsername);
                }
                await this._sessionManager.connectWithCredential(config);
                return true;
            }
            // Check if we have token-based authentication data
            if (storedCredentialToken) {
                // Create token config from stored data
                const { createTokenConfig } = require('./models/config');
                const config = createTokenConfig(storedCredentialToken, {
                    pushNotificationDeviceToken: storedPushToken,
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
        }
        catch (error) {
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
     * @param debug Optional flag to enable call quality metrics for this call
     * @returns A Promise that completes with the Call object once the invitation has been sent
     *
     * The call's state can be monitored through the returned Call object's streams.
     */
    async newCall(destination, debug = false) {
        this._throwIfDisposed();
        if (!destination || destination.trim() === '') {
            throw new Error('Destination is required');
        }
        if (this.currentConnectionState !== connection_state_1.TelnyxConnectionState.CONNECTED) {
            throw new Error(`Cannot make call when connection state is: ${this.currentConnectionState}`);
        }
        if (this._options.debug) {
            console.log('TelnyxVoipClient: Creating new call to:', destination);
        }
        return await this._callStateController.newCall(destination, undefined, undefined, debug);
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
    async handlePushNotification(payload) {
        this._throwIfDisposed();
        if (this._options.debug) {
            console.log('TelnyxVoipClient: Handling push notification:', payload);
        }
        try {
            // First, pass the push notification to the session manager for processing
            // This will set the isCallFromPush flag on the TelnyxRTC client
            await this._sessionManager.handlePushNotification(payload);
            // Connect if not already connected
            const currentState = this.currentConnectionState;
            if (currentState !== connection_state_1.TelnyxConnectionState.CONNECTED) {
                // Try to login from stored config - now the push flags should be set
                const loginSuccess = await this.loginFromStoredConfig();
                if (!loginSuccess) {
                    console.warn('TelnyxVoipClient: Could not login from stored config for push notification');
                    return;
                }
            }
        }
        catch (error) {
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
    disablePushNotifications() {
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
    setCallConnecting(callId) {
        this._callStateController.setCallConnecting(callId);
    }
    /**
     * Find a call by its underlying Telnyx call object
     * @param telnyxCall The Telnyx call object to find
     * @internal
     */
    findCallByTelnyxCall(telnyxCall) {
        return this._callStateController.findCallByTelnyxCall(telnyxCall);
    }
    /**
     * Queue an answer action for when the call invite arrives (for CallKit integration)
     * This should be called when the user answers from CallKit before the socket connection is established
     * @param customHeaders Optional custom headers to include with the answer
     */
    queueAnswerFromCallKit(customHeaders = {}) {
        this._throwIfDisposed();
        if (this._options.debug) {
            console.log('TelnyxVoipClient: Queuing answer action from CallKit', customHeaders);
        }
        const telnyxClient = this._sessionManager.telnyxClient;
        if (telnyxClient && typeof telnyxClient.queueAnswerFromCallKit === 'function') {
            telnyxClient.queueAnswerFromCallKit(customHeaders);
        }
        else {
            console.warn('TelnyxVoipClient: TelnyxRTC client not available or method not found for queueAnswerFromCallKit');
        }
    }
    /**
     * Queue an end action for when the call invite arrives (for CallKit integration)
     * This should be called when the user ends from CallKit before the socket connection is established
     */
    queueEndFromCallKit() {
        this._throwIfDisposed();
        if (this._options.debug) {
            console.log('TelnyxVoipClient: Queuing end action from CallKit');
        }
        const telnyxClient = this._sessionManager.telnyxClient;
        if (telnyxClient && typeof telnyxClient.queueEndFromCallKit === 'function') {
            telnyxClient.queueEndFromCallKit();
        }
        else {
            console.warn('TelnyxVoipClient: TelnyxRTC client not available or method not found for queueEndFromCallKit');
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
    dispose() {
        if (this._disposed) {
            return;
        }
        if (this._options.debug) {
            console.log('TelnyxVoipClient: Disposing client');
        }
        this._disposed = true;
        this._callStateController.dispose();
        this._sessionManager.dispose();
    }
    // ========== Private Methods ==========
    /**
     * Throw an error if the client has been disposed
     */
    _throwIfDisposed() {
        if (this._disposed) {
            throw new Error('TelnyxVoipClient has been disposed');
        }
    }
}
exports.TelnyxVoipClient = TelnyxVoipClient;
// ========== Factory Functions ==========
/**
 * Create a new TelnyxVoipClient instance for normal app usage
 */
function createTelnyxVoipClient(options) {
    return new TelnyxVoipClient(options);
}
/**
 * Create a new TelnyxVoipClient instance for background push notification handling
 */
function createBackgroundTelnyxVoipClient(options) {
    return new TelnyxVoipClient(options);
}
