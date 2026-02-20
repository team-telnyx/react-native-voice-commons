'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, '__esModule', { value: true });
exports.SessionManager = void 0;
const rxjs_1 = require('rxjs');
const operators_1 = require('rxjs/operators');
const TelnyxSDK = __importStar(require('@telnyx/react-native-voice-sdk'));
const connection_state_1 = require('../../models/connection-state');
const config_1 = require('../../models/config');
/**
 * Manages the connection lifecycle to the Telnyx platform.
 *
 * This class handles authentication, connection state management,
 * and automatic reconnection logic.
 */
class SessionManager {
  constructor() {
    this._connectionState = new rxjs_1.BehaviorSubject(
      connection_state_1.TelnyxConnectionState.DISCONNECTED
    );
    this._disposed = false;
    this._sessionId = this._generateSessionId();
  }
  /**
   * Observable stream of connection state changes
   */
  get connectionState$() {
    return this._connectionState.asObservable().pipe((0, operators_1.distinctUntilChanged)());
  }
  /**
   * Set callback to be called when the Telnyx client is ready
   */
  setOnClientReady(callback) {
    this._onClientReady = callback;
  }
  /**
   * Current connection state (synchronous access)
   */
  get currentState() {
    return this._connectionState.value;
  }
  /**
   * Current session ID
   */
  get sessionId() {
    return this._sessionId;
  }
  /**
   * Get the underlying Telnyx client instance
   */
  get telnyxClient() {
    return this._telnyxClient;
  }
  /**
   * Connect using credential authentication
   */
  async connectWithCredential(config) {
    if (this._disposed) {
      throw new Error('SessionManager has been disposed');
    }
    this._currentConfig = config;
    await this._connect();
  }
  /**
   * Connect using token authentication
   */
  async connectWithToken(config) {
    if (this._disposed) {
      throw new Error('SessionManager has been disposed');
    }
    this._currentConfig = config;
    await this._connect();
  }
  /**
   * Disconnect from the Telnyx platform
   */
  async disconnect() {
    if (this._disposed) {
      return;
    }
    this._currentConfig = undefined;
    if (this._telnyxClient) {
      try {
        await this._telnyxClient.disconnect();
      } catch (error) {
        console.error('Error during disconnect:', error);
      }
    }
    this._connectionState.next(connection_state_1.TelnyxConnectionState.DISCONNECTED);
  }
  /**
   * Disable push notifications for the current session.
   * Delegates to the TelnyxRTC client's disablePushNotification() method
   * which sends a 'telnyx_rtc.disable_push_notification' message via the socket.
   */
  disablePushNotifications() {
    if (
      this._telnyxClient &&
      this.currentState === connection_state_1.TelnyxConnectionState.CONNECTED
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
  handlePushNotificationWithConfig(pushMetaData, config) {
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
  async handlePushNotification(payload) {
    if (this._disposed) {
      return;
    }
    console.log(
      'SessionManager: RELEASE DEBUG - Processing push notification, payload:',
      JSON.stringify(payload)
    );
    // Store the push notification payload for when the client is created
    this._pendingPushPayload = payload;
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
      // Use type assertion to access the processVoIPNotification method
      // This method sets the isCallFromPush flag which is needed for proper push handling
      if (typeof this._telnyxClient.processVoIPNotification === 'function') {
        console.log(
          'SessionManager: RELEASE DEBUG - Calling processVoIPNotification with payload:',
          JSON.stringify(payload)
        );
        // Extract the actual push notification metadata that the client expects
        const actualPayload = this._extractPushPayload(payload);
        this._telnyxClient.processVoIPNotification(actualPayload);
        console.log('SessionManager: RELEASE DEBUG - Called processVoIPNotification successfully');
      } else {
        console.warn(
          'SessionManager: processVoIPNotification method not available on TelnyxRTC client'
        );
      }
      // Clear the pending payload since it was processed
      this._pendingPushPayload = null;
    } else {
      console.log(
        'SessionManager: RELEASE DEBUG - No client available, checking if we can trigger immediate connection'
      );
      // If we have config (either existing or newly loaded from storage) and are disconnected, trigger immediate connection
      // The _connect() method will process the pending push payload BEFORE calling connect()
      if (
        this._currentConfig &&
        this.currentState === connection_state_1.TelnyxConnectionState.DISCONNECTED
      ) {
        console.log(
          'SessionManager: RELEASE DEBUG - Triggering immediate connection for push notification with config type:',
          this._currentConfig.type || 'credential'
        );
        try {
          await this._connect();
          console.log(
            'SessionManager: RELEASE DEBUG - Successfully connected after push notification trigger'
          );
        } catch (error) {
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
          'SessionManager: RELEASE DEBUG - Push payload stored for later processing when client becomes available'
        );
      }
    }
    console.log('SessionManager: RELEASE DEBUG - Push notification handling complete');
  }
  /**
   * Dispose of the session manager and clean up resources
   */
  dispose() {
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
  async _connect() {
    if (!this._currentConfig) {
      throw new Error('No configuration provided');
    }
    this._connectionState.next(connection_state_1.TelnyxConnectionState.CONNECTING);
    try {
      // Clean up existing client
      if (this._telnyxClient) {
        await this._telnyxClient.disconnect();
      }
      // Create new client instance with authentication options
      let clientOptions;
      if ((0, config_1.isCredentialConfig)(this._currentConfig)) {
        clientOptions = {
          login: this._currentConfig.sipUser,
          password: this._currentConfig.sipPassword,
          logLevel: this._currentConfig.debug ? 'debug' : 'warn',
          pushNotificationDeviceToken: this._currentConfig.pushNotificationDeviceToken,
        };
        console.log(
          '🔧 SessionManager: Creating TelnyxRTC with credential config, logLevel:',
          clientOptions.logLevel,
          'pushToken:',
          !!this._currentConfig.pushNotificationDeviceToken
        );
      } else if ((0, config_1.isTokenConfig)(this._currentConfig)) {
        clientOptions = {
          login_token: this._currentConfig.token,
          logLevel: this._currentConfig.debug ? 'debug' : 'warn',
          pushNotificationDeviceToken: this._currentConfig.pushNotificationDeviceToken,
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
      const pendingPushPayload = this._pendingPushPayload;
      if (pendingPushPayload) {
        console.log(
          'SessionManager: RELEASE DEBUG - Processing pending push notification BEFORE connect:',
          JSON.stringify(pendingPushPayload)
        );
        if (typeof this._telnyxClient.processVoIPNotification === 'function') {
          console.log(
            'SessionManager: RELEASE DEBUG - Calling processVoIPNotification BEFORE connect to set voice_sdk_id'
          );
          // Extract the actual push notification metadata that the client expects
          const actualPayload = this._extractPushPayload(pendingPushPayload);
          this._telnyxClient.processVoIPNotification(actualPayload);
          console.log(
            'SessionManager: RELEASE DEBUG - Successfully processed pending push notification before connect'
          );
        } else {
          console.warn(
            'SessionManager: processVoIPNotification method not available on new client'
          );
        }
        // Clear the pending payload
        this._pendingPushPayload = null;
      }
      this._setupClientListeners();
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
      // Connect to the platform AFTER processing push notification
      console.log(
        'SessionManager: RELEASE DEBUG - About to call connect() after processing push notification'
      );
      await this._telnyxClient.connect();
      // Notify that client is ready for event listeners
      console.log('🔧 SessionManager: Client connected successfully');
    } catch (error) {
      console.error('Connection failed:', error);
      this._connectionState.next(connection_state_1.TelnyxConnectionState.ERROR);
      throw error;
    }
  }
  /**
   * Set up event listeners for the Telnyx client
   */
  _setupClientListeners() {
    if (!this._telnyxClient) {
      return;
    }
    this._telnyxClient.on('telnyx.client.ready', () => {
      console.log('Telnyx client ready');
      this._connectionState.next(connection_state_1.TelnyxConnectionState.CONNECTED);
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
    this._telnyxClient.on('telnyx.client.error', (error) => {
      console.error('Telnyx client error:', error);
      this._connectionState.next(connection_state_1.TelnyxConnectionState.ERROR);
    });
    // Note: Socket-level events are not exposed in the current SDK
    // We'll rely on the client-level events for now
  }
  /**
   * Extract the actual payload metadata from wrapped push notification payload
   */
  _extractPushPayload(payload) {
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
  _generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
exports.SessionManager = SessionManager;
