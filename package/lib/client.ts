import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventEmitter } from 'eventemitter3';
import log from 'loglevel';
import { Call } from './call';
import type { CallOptions } from './call-options';
import type { ClientOptions } from './client-options';
import { Connection } from './connection';
import { KeepAliveHandler } from './keep-alive-handler';
import { eventBus } from './legacy-event-bus';
import { LoginHandler } from './login-handler';
import type { InviteEvent, AnswerEvent } from './messages/call';
import { createInviteAckMessage, isInviteEvent, createAnswerAck, isAnswerEvent } from './messages/call';
import { createAttachCallMessage } from './messages/attach';
import type { AttachEvent } from './messages/attach';
import { isAttachEvent } from './messages/attach';
import type { MediaEvent } from './messages/media';
import { isMediaEvent } from './messages/media';
import { isValidGatewayStateResponse } from './messages/gateway';
import { from } from 'rxjs';

type TelnyxRTCEvents = {
  'telnyx.client.ready': () => void;
  'telnyx.client.error': (error: Error) => void;
  'telnyx.call.incoming': (call: Call, msg: InviteEvent) => void;
  'telnyx.call.reattached': (call: Call, msg: AttachEvent) => void;
  'telnyx.media.received': (msg: MediaEvent) => void;
  'telnyx.call.answered': (call: Call, msg: AnswerEvent) => void;
};

export class TelnyxRTC extends EventEmitter<TelnyxRTCEvents> {
  public options: ClientOptions;
  public call: Call | null;
  public sessionId: string | null;

  private connection: Connection | null;
  private loginHandler: LoginHandler | null;
  private keepAliveHandler: KeepAliveHandler | null;
  private netInfoSubscription: NetInfoSubscription | null = null;

  // Network reconnection state
  private reconnecting: boolean = false;
  private lastNetworkType: string | null = null; // Track network type changes
  private credentialSessionConfig: any = null; // Store login credentials for reconnection
  private tokenSessionConfig: any = null; // Store login token for reconnection
  private reconnectionTimeoutHandle: any = null;
  private reconnectionSessionId: string | null = null; // Store sessionId during reconnection
  private static readonly RECONNECT_DELAY = 3000; // 3 seconds
  private static readonly RECONNECT_TIMEOUT = 60000; // 30 seconds

  // Push notification support
  private isCallFromPush: boolean = false;
  private pushNotificationPayload: any = null;
  private pendingInvite: InviteEvent | null = null;

  // Early media/ringback support
  private pendingMediaEvents: Map<string, MediaEvent> = new Map();

  // Pending call actions (matching iOS SDK behavior)
  private pendingAnswerAction: boolean = false;
  private pendingEndAction: boolean = false;
  private pendingCustomHeaders: Record<string, string> = {};

  // AsyncStorage keys for persisting push state
  private static readonly PUSH_STATE_KEY = '@telnyx_push_state';
  private static readonly PUSH_VOICE_SDK_ID_KEY = '@telnyx_push_voice_sdk_id';

  /**
   * Save push notification state to AsyncStorage
   */
  private async savePushState() {
    try {
      const pushState = {
        isCallFromPush: this.isCallFromPush,
        pushNotificationPayload: this.pushNotificationPayload,
        pushNotificationCallKitUUID: this.pushNotificationCallKitUUID,
        voice_sdk_id: (this as any)._pushVoiceSDKId,
        timestamp: Date.now(),
      };

      await AsyncStorage.setItem(TelnyxRTC.PUSH_STATE_KEY, JSON.stringify(pushState));
      log.debug('[TelnyxRTC] Saved push state to AsyncStorage:', pushState);
    } catch (error) {
      log.error('[TelnyxRTC] Failed to save push state to AsyncStorage:', error);
    }
  }

  /**
   * Load push notification state from AsyncStorage
   */
  private async loadPushState() {
    try {
      const pushStateJson = await AsyncStorage.getItem(TelnyxRTC.PUSH_STATE_KEY);
      if (!pushStateJson) {
        log.debug('[TelnyxRTC] No saved push state found');
        return;
      }

      const pushState = JSON.parse(pushStateJson);

      // Only restore if state is recent (within last 30 seconds to handle fresh push notifications)
      const ageMs = Date.now() - (pushState.timestamp || 0);
      if (ageMs > 30000) {
        log.debug('[TelnyxRTC] Saved push state is too old, ignoring');
        await this.clearPushState();
        return;
      }

      this.isCallFromPush = pushState.isCallFromPush || false;
      this.pushNotificationPayload = pushState.pushNotificationPayload || null;
      this.pushNotificationCallKitUUID = pushState.pushNotificationCallKitUUID || null;
      (this as any)._pushVoiceSDKId = pushState.voice_sdk_id || null;

      log.debug('[TelnyxRTC] Restored push state from AsyncStorage:', pushState);
      console.log('[TelnyxRTC] RELEASE DEBUG - Restored push state from AsyncStorage:', pushState);
    } catch (error) {
      log.error('[TelnyxRTC] Failed to load push state from AsyncStorage:', error);
    }
  }

  /**
   * Clear push notification state from AsyncStorage
   */
  private async clearPushState() {
    try {
      await AsyncStorage.removeItem(TelnyxRTC.PUSH_STATE_KEY);
      log.debug('[TelnyxRTC] Cleared push state from AsyncStorage');
    } catch (error) {
      log.error('[TelnyxRTC] Failed to clear push state from AsyncStorage:', error);
    }
  }

  constructor(opts: ClientOptions) {
    super();
    this.options = opts;

    this.connection = null;
    this.sessionId = null;
    this.loginHandler = null;
    this.keepAliveHandler = null;
    this.call = null;

    // Initialize pending actions
    this.pendingAnswerAction = false;
    this.pendingEndAction = false;
    this.pendingCustomHeaders = {};

    // Force debug logging in development or when explicitly requested
    const shouldDebug = __DEV__ || opts.logLevel === 'debug' || (global as any).__TELNYX_DEBUG__;
    const logLevel = shouldDebug ? 'debug' : opts.logLevel || 'warn';
    log.setLevel(logLevel);
    console.log(
      `🔧 TelnyxRTC: Log level set to '${logLevel}' (dev: ${__DEV__}, requested: ${opts.logLevel})`
    );

    // Initialize lastNetworkType with current network state
    try {
      NetInfo.fetch().then((state) => {
        this.lastNetworkType = state.type;
        log.debug('[TelnyxRTC] Initial network type set to:', state.type);
      }).catch((error) => {
        log.warn('[TelnyxRTC] Failed to fetch initial network state:', error);
      });

      this.netInfoSubscription = NetInfo.addEventListener(this.onNetInfoStateChange);
    } catch (error) {
      log.warn('[TelnyxRTC] NetInfo not available, network monitoring disabled:', error);
    }
  }

  /**
   * Initiates a new call.
   * @param options The options for the new call.
   * @example
   * ```typescript
   * import { TelnyxRTC } from '@telnyx/react-native-voice-sdk';
   * const telnyxRTC = new TelnyxRTC({ loginToken: 'your_login_token' });
   * await telnyxRTC.connect();
   * const call = await telnyxRTC.newCall({
   *   destinationNumber: '+1234567890',
   *   callerIdNumber: '+0987654321',
   *   callerIdName: 'My Name',
   *   customHeaders: [{ name: 'X-Custom-Header', value: 'value' }],
   * });
   * console.log('Call initiated:', call);
   *
   * @returns a Promise that resolves to the Call instance.
   * @throws Error if no connection or session ID exists.
   */
  public newCall = async (options: CallOptions) => {
    if (!this.connection) {
      log.error('[TelnyxRTC] No connection exists. Please connect first.');
      throw new Error('[TelnyxRTC] No connection exists. Please connect first.');
    }

    if (!this.sessionId) {
      log.error('[TelnyxRTC] No session ID exists. Please connect first.');
      throw new Error('[TelnyxRTC] No session ID exists. Please connect first.');
    }

    this.call = new Call({
      connection: this.connection,
      direction: 'outbound',
      sessionId: this.sessionId,
      telnyxSessionId: null,
      telnyxLegId: null,
      callId: null,
      options,
    });

    await this.call.invite();
    return this.call;
  };

  /**
   * Process a VoIP push notification for an incoming call.
   * This should be called when a push notification is received to prepare for the incoming call.
   * @param pushNotificationPayload The push notification payload containing call metadata
   * @example
   * ```typescript
   * const telnyxRTC = new TelnyxRTC({ loginToken: 'your_login_token' });
   * telnyxRTC.processVoIPNotification(pushPayload);
   * await telnyxRTC.connect();
   * ```
   */
  public processVoIPNotification(pushNotificationPayload: any) {
    log.debug('[TelnyxRTC] Processing VoIP push notification:', pushNotificationPayload);
    this.isCallFromPush = true;
    this.pushNotificationPayload = pushNotificationPayload;

    // Extract voice_sdk_id from push notification metadata (matching iOS SDK)
    const metadata = pushNotificationPayload?.metadata || pushNotificationPayload;
    if (metadata?.voice_sdk_id) {
      const newVoiceSDKId = metadata.voice_sdk_id;
      const currentVoiceSDKId = (this as any)._pushVoiceSDKId;

      log.debug('[TelnyxRTC] Extracted voice_sdk_id from push notification:', newVoiceSDKId);
      log.debug('[TelnyxRTC] Current stored voice_sdk_id:', currentVoiceSDKId);

      // Console logs for release debugging
      console.log(
        '[TelnyxRTC] RELEASE DEBUG - Extracted voice_sdk_id from push notification:',
        newVoiceSDKId
      );
      console.log('[TelnyxRTC] RELEASE DEBUG - Current stored voice_sdk_id:', currentVoiceSDKId);

      if (newVoiceSDKId !== currentVoiceSDKId) {
        log.debug('[TelnyxRTC] Updating voice_sdk_id with fresh value from push notification');
        (this as any)._pushVoiceSDKId = newVoiceSDKId;
      } else {
        log.debug(
          '[TelnyxRTC] Voice_sdk_id unchanged - may be reprocessing same push notification'
        );
      }
    } else {
      log.warn('[TelnyxRTC] No voice_sdk_id found in push notification payload');
    }

    log.debug('[TelnyxRTC] isCallFromPush flag set to:', this.isCallFromPush);

    // Save push state to AsyncStorage for persistence across client recreation
    this.savePushState().catch((error) => {
      log.error('[TelnyxRTC] Failed to save push state:', error);
    });
  }

  /**
   * Queue an answer action for when the call invite arrives (matching iOS SDK behavior)
   * This should be called when the user answers from CallKit before the socket connection is established
   * @param customHeaders Optional custom headers to include with the answer
   */
  public queueAnswerFromCallKit(customHeaders: Record<string, string> = {}) {
    log.debug('[TelnyxRTC] Queuing answer action from CallKit', customHeaders);
    this.pendingAnswerAction = true;
    this.pendingCustomHeaders = customHeaders;

    // If call already exists, answer immediately
    if (this.call && this.call.state === 'ringing') {
      log.debug('[TelnyxRTC] Call exists, answering immediately');
      this.executePendingAnswer();
    } else {
      log.debug('[TelnyxRTC] Call not yet available, answer will be executed when invite arrives');
    }
  }

  /**
   * Queue an end action for when the call invite arrives (matching iOS SDK behavior)
   * This should be called when the user ends from CallKit before the socket connection is established
   */
  public queueEndFromCallKit() {
    log.debug('[TelnyxRTC] Queuing end action from CallKit');
    this.pendingEndAction = true;

    // If call already exists, end immediately
    if (this.call) {
      log.debug('[TelnyxRTC] Call exists, ending immediately');
      this.executePendingEnd();
    } else {
      log.debug('[TelnyxRTC] Call not yet available, end will be executed when invite arrives');
    }
  }

  // Store push notification CallKit UUID for automatic linking
  private pushNotificationCallKitUUID: string | null = null;

  /**
   * Set the CallKit UUID for the expected push notification call (matching iOS SDK approach)
   * This should be called by CallKitHandler using the call_id from push notification metadata
   */
  public setPushNotificationCallKitUUID(uuid: string | null) {
    log.debug('[TelnyxRTC] Storing push notification CallKit UUID for automatic assignment:', uuid);
    this.pushNotificationCallKitUUID = uuid;
  }

  /**
   * Get the stored push notification CallKit UUID
   */
  public getPushNotificationCallKitUUID(): string | null {
    return this.pushNotificationCallKitUUID;
  }

  /**
   * Execute pending answer action
   */
  private async executePendingAnswer() {
    if (!this.pendingAnswerAction || !this.call) {
      return;
    }

    try {
      log.debug('[TelnyxRTC] Executing pending answer action');

      // Convert Record<string, string> to { name: string; value: string }[] format
      const customHeaders = Object.entries(this.pendingCustomHeaders).map(([name, value]) => ({
        name,
        value,
      }));

      // Use the answer method with custom headers
      await this.call.answer(customHeaders);
      log.debug('[TelnyxRTC] Pending answer executed successfully');
    } catch (error) {
      log.error('[TelnyxRTC] Failed to execute pending answer:', error);
    } finally {
      this.resetPendingActions();
    }
  }

  /**
   * Execute pending end action
   */
  private executePendingEnd() {
    if (!this.pendingEndAction || !this.call) {
      return;
    }

    try {
      log.debug('[TelnyxRTC] Executing pending end action');
      this.call.hangup();
      log.debug('[TelnyxRTC] Pending end executed successfully');
    } catch (error) {
      log.error('[TelnyxRTC] Failed to execute pending end:', error);
    } finally {
      this.resetPendingActions();
    }
  }

  /**
   * Reset pending action flags (matching iOS SDK resetPushVariables)
   * Note: isCallFromPush is NOT reset here as it should persist until disconnect
   */
  private resetPendingActions() {
    log.debug('[TelnyxRTC] Resetting pending actions');
    this.pendingAnswerAction = false;
    this.pendingEndAction = false;
    this.pendingCustomHeaders = {};
    // Don't reset isCallFromPush here - it should persist until explicit disconnect
    // this.isCallFromPush = false;
  }

  /**
   *
   * @returns A Promise that resolves when the connection is established.
   * @throws Error if the connection already exists or login fails.
   * @example
   * ```typescript
   * import { TelnyxRTC } from '@telnyx/react-native-voice-sdk';
   * const telnyxRTC = new TelnyxRTC({ loginToken: 'your_login_token' });
   * await telnyxRTC.connect();
   * console.log('Connected to Telnyx RTC');
   * ```
   * Connects to the Telnyx RTC service.
   * This method initializes the connection, logs in using the provided options,
   * and sets up the necessary event listeners.
   * It emits a 'telnyx.client.ready' event when the connection is successfully established.
   * If a connection already exists, it logs a warning and does not create a new connection.
   * If the login fails, it logs an error and throws an exception.
   * @see {@link ClientOptions} for the options that can be passed to the constructor.
   */
  public async connect() {
    if (this.connection) {
      log.warn('A connection already exists. Please close it before creating a new one.');
      return;
    }

    log.debug('[TelnyxRTC] Starting connection process...');

    // Store login configuration for potential reconnection
    if ('loginToken' in this.options) {
      this.tokenSessionConfig = this.options;
      log.debug('[TelnyxRTC] Stored token configuration for reconnection');
    } else if ('sipUser' in this.options && 'sipPassword' in this.options) {
      this.credentialSessionConfig = this.options;
      log.debug('[TelnyxRTC] Stored credential configuration for reconnection');
    }

    // Ensure push state is loaded before proceeding with connection
    // This is critical for push notifications where state might be restored from AsyncStorage
    try {
      await this.loadPushState();
      log.debug('[TelnyxRTC] Push state loading completed before connection');
    } catch (error) {
      log.error('[TelnyxRTC] Failed to load push state before connection:', error);
    }

    // Use custom voice_sdk_id for push notifications (matching iOS SDK behavior)
    const pushVoiceSDKId = (this as any)._pushVoiceSDKId;
    if (this.isCallFromPush && pushVoiceSDKId) {
      log.debug(
        '[TelnyxRTC] Creating connection with push notification voice_sdk_id:',
        pushVoiceSDKId
      );
      console.log(
        '[TelnyxRTC] RELEASE DEBUG - Creating connection with push notification voice_sdk_id:',
        pushVoiceSDKId
      );
      this.connection = new Connection(pushVoiceSDKId);
    } else {
      log.debug('[TelnyxRTC] Creating standard connection');
      console.log(
        '[TelnyxRTC] RELEASE DEBUG - Creating standard connection, isCallFromPush:',
        this.isCallFromPush,
        'pushVoiceSDKId:',
        pushVoiceSDKId
      );
      this.connection = new Connection();
    }

    // Store reference to this client in the connection for CallKit UUID access
    this.connection._client = this;

    log.debug('[TelnyxRTC] Setting up connection event listeners');
    this.connection.addListener('telnyx.socket.message', this.onSocketMessage);
    this.connection.addListener('telnyx.socket.error', (error) => {
      log.error('[TelnyxRTC] WebSocket connection error:', error);
    });
    this.connection.addListener('telnyx.socket.close', () => {
      log.debug('[TelnyxRTC] WebSocket connection closed');
    });

    // Wait for WebSocket connection to be established
    if (!this.connection.isConnected) {
      log.debug('[TelnyxRTC] Waiting for WebSocket connection...');
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout after 15 seconds'));
        }, 15000); // 15 second timeout

        const onOpen = () => {
          log.debug('[TelnyxRTC] WebSocket connection established');
          clearTimeout(timeout);
          this.connection!.removeListener('telnyx.socket.open', onOpen);
          this.connection!.removeListener('telnyx.socket.error', onError);
          this.connection!.removeListener('telnyx.socket.close', onClose);
          resolve();
        };

        const onError = (error: Event) => {
          log.error('[TelnyxRTC] WebSocket connection failed:', error);
          clearTimeout(timeout);
          this.connection!.removeListener('telnyx.socket.open', onOpen);
          this.connection!.removeListener('telnyx.socket.error', onError);
          this.connection!.removeListener('telnyx.socket.close', onClose);

          // Clear push-specific voice_sdk_id on connection failure to allow normal reconnection
          if ((this as any)._pushVoiceSDKId) {
            log.debug(
              '[TelnyxRTC] Clearing push voice_sdk_id after connection failure to enable normal reconnection'
            );
            (this as any)._pushVoiceSDKId = null;
          }

          reject(new Error(`WebSocket connection failed: ${error.type}`));
        };

        const onClose = () => {
          log.debug('[TelnyxRTC] WebSocket connection closed during connection attempt');
          clearTimeout(timeout);
          this.connection!.removeListener('telnyx.socket.open', onOpen);
          this.connection!.removeListener('telnyx.socket.error', onError);
          this.connection!.removeListener('telnyx.socket.close', onClose);

          // Clear push-specific voice_sdk_id on connection close to allow normal reconnection
          if ((this as any)._pushVoiceSDKId) {
            log.debug(
              '[TelnyxRTC] Clearing push voice_sdk_id after connection close to enable normal reconnection'
            );
            (this as any)._pushVoiceSDKId = null;
          }

          reject(new Error('WebSocket connection closed unexpectedly'));
        };

        this.connection!.addListener('telnyx.socket.open', onOpen);
        this.connection!.addListener('telnyx.socket.error', onError);
        this.connection!.addListener('telnyx.socket.close', onClose);
      });
    }

    this.loginHandler = new LoginHandler(this.connection);
    this.keepAliveHandler = new KeepAliveHandler(this.connection);
    this.keepAliveHandler.start();

    // Set push notification flags if this is a push-initiated connection
    log.debug('[TelnyxRTC] Checking isCallFromPush flag:', this.isCallFromPush);
    if (this.isCallFromPush) {
      log.debug('[TelnyxRTC] Setting push notification flags for login');
      this.loginHandler.setAttachCall(true);
      this.loginHandler.setFromPush(true);
    } else {
      log.debug('[TelnyxRTC] Not a push connection, no push flags needed');
    }

    log.debug('[TelnyxRTC] Attempting login...');
    // The attach_call parameter and sessid are now handled automatically in the LoginHandler
    log.debug('[TelnyxRTC] Login will include attach_call and sessid (if available) for reliable reconnection');

    this.sessionId = await this.loginHandler.login(this.options);
    if (!this.sessionId) {
      log.error('Login failed. Please check your credentials and try again.');
      throw new Error('Login failed. Please check your credentials and try again.');
    }

    log.debug('[TelnyxRTC] Login successful, session ID:', this.sessionId);

    // Don't send attach call if we expect an invite to come through
    // The attach call is mainly for cases where the invite might be missed
    // Since we're connected and ready, we should receive the invite directly
    if (this.isCallFromPush && this.pushNotificationPayload) {
      log.debug(
        '[TelnyxRTC] Connection initiated by push notification - waiting for invite instead of sending attach call'
      );
      log.debug('[TelnyxRTC] Push payload ready for processing:', this.pushNotificationPayload);
    }

    // Process any pending invite that arrived during login (matching iOS SDK behavior)
    if (this.pendingInvite) {
      log.debug('[TelnyxRTC] Processing pending invite received during login (matches iOS SDK)');
      log.debug('[TelnyxRTC] Pending invite call ID:', this.pendingInvite.params.callID);
      const pendingInvite = this.pendingInvite;
      this.pendingInvite = null; // Clear the pending invite
      await this.processInvite(pendingInvite);
    } else {
      log.debug('[TelnyxRTC] No pending invites to process');
    }

    this.emit('telnyx.client.ready');
  }

  /**
   * Disconnects from the Telnyx RTC service.
   * This method closes the WebSocket connection and removes all event listeners.
   * If no connection exists, it logs a warning.
   * @example
   * ```typescript
   * import { TelnyxRTC } from '@telnyx/react-native-voice-sdk';
   * const telnyxRTC = new TelnyxRTC({ loginToken: 'your_login_token' });
   * await telnyxRTC.connect();
   * // ... use the TelnyxRTC instance ...
   * telnyxRTC.disconnect();
   * console.log('Disconnected from Telnyx RTC');
   * ```
   */
  public disconnect(fromReconnection: boolean = false) {
    if (!this.connection) {
      log.warn('No connection exists.');
      return;
    }

  
    this.cancelReconnectionTimer();

    // Clear stored configurations
    this.credentialSessionConfig = null;
    this.tokenSessionConfig = null;

    this.connection.close();
    this.connection = null;

    if (!fromReconnection) {
      log.debug('[TelnyxRTC] Disconnected due to reconnection process');
      this.removeAllListeners();
      try {
        this.netInfoSubscription?.();
      } catch (error) {
        log.warn('[TelnyxRTC] NetInfo subscription cleanup failed:', error);
      }

      // Clear push-specific voice_sdk_id on disconnect to ensure clean state
      if ((this as any)._pushVoiceSDKId) {
        log.debug('[TelnyxRTC] Clearing push voice_sdk_id on disconnect');
        (this as any)._pushVoiceSDKId = null;
      }
    }


    // Reset push flags on disconnect to ensure clean state for next connection
    // Preserve push-related flags during reconnection so they survive the disconnect
    if (!this.reconnecting) {
      this.isCallFromPush = false;
      this.pushNotificationPayload = null;
      this.pendingInvite = null;
      this.pushNotificationCallKitUUID = null;
        // Cancel any ongoing reconnection process
      this.reconnecting = false;
      log.debug('[TelnyxRTC] Reset push flags on disconnect');

      // Clear stored push state from AsyncStorage
      this.clearPushState().catch((error) => {
        log.error('[TelnyxRTC] Failed to clear push state on disconnect:', error);
      });
    } else {
      log.debug('[TelnyxRTC] Preserving push flags due to ongoing reconnection');
    }

    log.warn('[TelnyxRTC] Disconnected from Telnyx RTC');
  }

  public get connected() {
    return this.connection !== null && this.connection.isConnected;
  }


  private onSocketMessage = (msg: unknown) => {
    log.debug('[TelnyxRTC] Processing socket message:', msg);

    if (isInviteEvent(msg)) {
      log.debug('[TelnyxRTC] Detected invite event, processing...');

      // Console log for release debugging
      console.log(
        '[TelnyxRTC] RELEASE DEBUG - Detected invite event, processing...',
        JSON.stringify(msg)
      );

      return this.handleCallInvite(msg);
    }

    if (isAttachEvent(msg)) {
      log.debug('[TelnyxRTC] Detected attach event, processing...');
      console.log(
        '[TelnyxRTC] RELEASE DEBUG - Detected attach event, processing...',
        JSON.stringify(msg)
      );
      return this.handleCallAttach(msg);
    }

    if (isMediaEvent(msg)) {
      log.debug('[TelnyxRTC] Detected media event, processing...');
      console.log(
        '[TelnyxRTC] RELEASE DEBUG - Detected media event, processing...',
        JSON.stringify(msg)
      );
      return this.handleMediaEvent(msg);
    }

    if (isAnswerEvent(msg)) {
      log.debug('[TelnyxRTC] Detected answer event, processing...');
      console.log(
        '[TelnyxRTC] RELEASE DEBUG - Detected answer event, processing...',
        JSON.stringify(msg)
      );
      return this.handleCallAnswer(msg);
    }

    // Check if this is an invite message that's not being detected
    if (msg && typeof msg === 'object' && (msg as any).method === 'telnyx_rtc.invite') {
      log.warn('[TelnyxRTC] Received invite message but isInviteEvent returned false:', msg);
    }

    log.debug('[TelnyxRTC] Message not processed as invite, attach, media, or answer');
    return;
  };

  private handleCallInvite = async (msg: InviteEvent) => {
    log.debug('[TelnyxRTC] ====== HANDLING CALL INVITE ======');
    log.debug('[TelnyxRTC] Invite message:', msg);

    if (!this.connection) {
      log.error('[TelnyxRTC] No connection exists. Please connect first.');
      throw new Error('[TelnyxRTC] Cannot receive calls without connection.');
    }

    // If sessionId is not available yet (during login process), store the invite for later processing
    // This matches iOS SDK behavior for push notification invites received during connection
    if (!this.sessionId) {
      log.debug('[TelnyxRTC] Session ID not available yet, storing invite for later processing');
      this.pendingInvite = msg;
      // Send acknowledgment even for pending invites
      log.debug('[TelnyxRTC] Sending invite acknowledgment for pending invite');
      this.connection?.send(createInviteAckMessage(msg.id));
      return;
    }

    log.debug('[TelnyxRTC] Session ID available, processing invite immediately');
    await this.processInvite(msg);
  };

  private processInvite = async (msg: InviteEvent) => {
    log.debug('[TelnyxRTC] Processing invite with session ID:', this.sessionId);

    log.debug('[TelnyxRTC] Sending invite acknowledgment');
    this.connection?.send(createInviteAckMessage(msg.id));

    // If this is a push notification call and we have a stored CallKit UUID,
    // ensure it's available for the createInboundCall method
    if (this.isCallFromPush && this.pushNotificationCallKitUUID) {
      log.debug(
        '[TelnyxRTC] Push notification call - CallKit UUID will be automatically assigned during call creation:',
        this.pushNotificationCallKitUUID
      );
    }

    log.debug('[TelnyxRTC] Creating inbound call object');
    
    // Check if we have SDP from invite or from a pending media event
    let remoteSDP = msg.params.sdp;
    const pendingMediaEvent = this.pendingMediaEvents.get(msg.params.callID);
    
    if (!remoteSDP && pendingMediaEvent?.params.sdp) {
      log.debug('[TelnyxRTC] Using SDP from pending media event for early media/ringback');
      remoteSDP = pendingMediaEvent.params.sdp;
    }
    
    if (!remoteSDP) {
      log.warn('[TelnyxRTC] No SDP available from invite or media event - call may not have early media');
      // Use empty SDP as fallback - peer connection will handle this gracefully
      remoteSDP = '';
    }
    
    this.call = await Call.createInboundCall({
      connection: this.connection!,
      remoteSDP,
      sessionId: this.sessionId!,
      callId: msg.params.callID,
      telnyxLegId: msg.params.telnyx_leg_id,
      telnyxSessionId: msg.params.telnyx_session_id,
      options: { destinationNumber: msg.params.caller_id_number },
      inviteCustomHeaders: msg.params.dialogParams?.custom_headers || null,
    });

    // Set call state to connecting after creation
    //(this.call as any).state = 'connecting';
    //this.call.emit('telnyx.call.state', this.call, 'connecting');
    log.debug('[TelnyxRTC] Call state set to connecting after creation');

    // Clean up the pending media event since we've processed it
    if (pendingMediaEvent) {
      this.pendingMediaEvents.delete(msg.params.callID);
      log.debug('[TelnyxRTC] Cleaned up pending media event for call:', msg.params.callID);
    }

    log.debug('[TelnyxRTC] Call object created, checking for pending actions');

    // Check for pending actions from CallKit (matching iOS SDK behavior)
    if (this.isCallFromPush) {
      log.debug('[TelnyxRTC] This is a push notification call, checking pending actions');

      // Check if this call came from a notification Answer action
      const fromNotification = this.pushNotificationPayload?.from_notification;
      const action = this.pushNotificationPayload?.action;

      if (fromNotification) {
        log.debug('[TelnyxRTC] <Call came from >notification Answer button - auto-answering');
        // Auto-answer the call since user already pressed Answer button
        if (this.call) {
          log.debug(
            '[TelnyxRTC] Auto-answering push notification call, current state:',
            this.call.state
          );
          if (action === 'answer') {
            this.call.answer();
          } else if (action === 'reject') {
            this.call.hangup();
          }
        }
      } else if (this.pendingAnswerAction) {
        log.debug('[TelnyxRTC] Found pending answer action, executing...');
        // Execute pending answer asynchronously to allow call setup to complete first
        setTimeout(() => this.executePendingAnswer(), 100);
      } else if (this.pendingEndAction) {
        log.debug('[TelnyxRTC] Found pending end action, executing...');
        // Execute pending end asynchronously
        setTimeout(() => this.executePendingEnd(), 100);
      } else {
        log.debug('[TelnyxRTC] No pending actions to execute for push notification call');
      }
    } else {
      log.debug('[TelnyxRTC] Not a push notification call, no pending actions to check');
    }

    log.debug('[TelnyxRTC] Emitting telnyx.call.incoming event');
    this.emit('telnyx.call.incoming', this.call, msg);

    log.debug('[TelnyxRTC] Emitting legacy event bus notification');
    eventBus.emit('telnyx.notification', {
      type: 'callUpdate',
      call: this.call,
    });

    log.debug('[TelnyxRTC] ====== CALL INVITE HANDLING COMPLETE ======');
  };

  private handleCallAttach = async (msg: AttachEvent) => {
    log.debug('[TelnyxRTC] ====== HANDLING CALL ATTACH ======');
    log.debug('[TelnyxRTC] Attach message:', msg);

    if (!this.connection) {
      log.error('[TelnyxRTC] No connection exists for attach.');
      return;
    }

    if (!this.sessionId) {
      log.error('[TelnyxRTC] No session ID available for attach.');
      return;
    }

    // Reset reconnecting state (like Android SDK onAttachReceived)
    this.reconnecting = false;
    this.cancelReconnectionTimer();


    log.debug('[TelnyxRTC] Creating new call object from attach message');

    // Create new inbound call from attach message (like Android SDK)
    this.call  = await Call.createInboundCall({
      connection: this.connection!,
      remoteSDP: msg.params.sdp,
      sessionId: this.sessionId!,
      callId: msg.params.callID,
      telnyxLegId: msg.params.telnyx_leg_id,
      telnyxSessionId: msg.params.telnyx_session_id,
      options: {
        destinationNumber: msg.params.caller_id_number
      },
      inviteCustomHeaders: msg.params.dialogParams?.custom_headers || null,
      initialState: 'connecting', // Set initial state to connecting
    });


    await this.call.answerAttach().then(() => {
      log.debug('[TelnyxRTC] AnswerAttach completed successfully');
    }).catch((error: Error) => {
      log.error('[TelnyxRTC] Failed to execute answerAttach:', error);
    });


    log.debug('[TelnyxRTC] Emitting telnyx.call.reattached event for reattached call');
    log.debug('[TelnyxRTC] Listeners for telnyx.call.reattached:', this.listenerCount('telnyx.call.reattached'));
    this.emit('telnyx.call.reattached', this.call, msg);

    log.debug('[TelnyxRTC] Emitting legacy event bus notification for reattached call');
    eventBus.emit('telnyx.notification', {
      type: 'callUpdate',
      call: this.call,
    });

    log.debug('[TelnyxRTC] ====== CALL ATTACH HANDLING COMPLETE ======');
  };

  private handleMediaEvent = (msg: MediaEvent) => {
    log.debug('[TelnyxRTC] ====== HANDLING MEDIA EVENT ======');
    log.debug('[TelnyxRTC] Media message:', msg);

    const callID = msg.params.callID;
    const sdp = msg.params.sdp;
    const audio = msg.params.audio;
    const video = msg.params.video;
    const target = msg.params.target || 'remote';

    log.debug(`[TelnyxRTC] Media event for call ${callID}:`, {
      sdp: sdp ? 'present' : 'not present',
      audio,
      video,
      target,
    });

    // Store media event for later use (in case invite comes after)
    this.pendingMediaEvents.set(callID, msg);

    // If we have an active call and it matches the callID, apply media changes
    if (this.call && this.call.callId === callID) {
      log.debug('[TelnyxRTC] Active call matches media event callID, applying changes');
      
      // If media event has SDP, handle early media setup
      if (sdp) {
        log.debug('[TelnyxRTC] Media event contains SDP - setting up early media/ringback');
        this.call.handleEarlyMedia(sdp);
      }
      
      // Apply audio/video changes if specified
      if (audio !== undefined || video !== undefined) {
        this.call.handleMediaUpdate({
          audio,
          video,
          target,
        });
      }
    } else {
      log.debug('[TelnyxRTC] No active call or callID mismatch, storing media event for later processing');
      // Media event received before invite - this is valid and expected for early media
    }

    // Always emit the media event for applications to handle
    log.debug('[TelnyxRTC] Emitting telnyx.media.received event');
    this.emit('telnyx.media.received', msg);

    log.debug('[TelnyxRTC] ====== MEDIA EVENT HANDLING COMPLETE ======');
  };

  private handleCallAnswer = (msg: AnswerEvent) => {
    log.debug('[TelnyxRTC] ====== HANDLING CALL ANSWER ======');
    log.debug('[TelnyxRTC] Answer message:', msg);

    const callID = msg.params.callID;
    const sdp = msg.params.sdp;

    log.debug(`[TelnyxRTC] Answer event for call ${callID}:`, {
      sdp: sdp ? 'present' : 'not present',
    });

    // Send ACK for the answer event
    if (this.connection) {
      log.debug('[TelnyxRTC] Sending answer acknowledgment');
      this.connection.send(createAnswerAck(msg.id));
    }

    // If we have an active call and it matches the callID, handle the answer
    if (this.call && this.call.callId === callID) {
      log.debug('[TelnyxRTC] Active call matches answer event callID, processing answer');
      
      // Store custom headers from the ANSWER message
      this.call.answerCustomHeaders = msg.params.dialogParams?.custom_headers || null;
      
      // If answer event has SDP, set it as remote description
      if (sdp) {
        log.debug('[TelnyxRTC] Answer event contains SDP - setting as remote description');
        this.call.handleRemoteAnswer(sdp);
      } else {
        log.debug('[TelnyxRTC] Answer event has no SDP - assuming SDP was handled via media event');
      }
      
      // Transition call to active state
      log.debug('[TelnyxRTC] Setting call state to active');
      this.call.setActive();
      
    } else {
      log.warn('[TelnyxRTC] No active call or callID mismatch for answer event');
    }

    // Emit the answer event for applications to handle
    log.debug('[TelnyxRTC] Emitting telnyx.call.answered event');
    if (this.call) {
      this.emit('telnyx.call.answered', this.call, msg);
    }

    log.debug('[TelnyxRTC] ====== CALL ANSWER HANDLING COMPLETE ======');
  };

  private onNetInfoStateChange = (state: NetInfoState) => {
    log.debug(`[TelnyxRTC] Network state changed:`, {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
      details: state.details
    });

    // Handle complete network loss
    if ((state.isInternetReachable === false || state.isConnected === false)) {
      log.debug('[TelnyxRTC] Network completely unavailable');
      this.onNetworkUnavailable();
      return;
    }

    // Handle network type changes (WiFi <-> Cellular transitions)
    if (this.lastNetworkType && this.lastNetworkType !== state.type) {
          // Update last known network type
      this.lastNetworkType = state.type;
      log.debug(`[TelnyxRTC] Network type changed: ${this.lastNetworkType} -> ${state.type}`);
      this.onNetworkTypeChanged(state);

      return;
    }



    // Handle network becoming available after being unavailable
    if (state.isInternetReachable === true && this.reconnecting) {
      this.onNetworkAvailable();
    }
  };

  /**
   * Handles network type changes (WiFi <-> Cellular transitions)
   * These transitions can disrupt WebRTC connections even when internet remains reachable
   */
  private onNetworkTypeChanged(state: NetInfoState) {
    log.debug('[TelnyxRTC] Network type changed - checking connection stability');
    
    // Give the network transition a moment to stabilize before checking connection
      if (state.isInternetReachable && this.reconnecting) {
        log.debug('[TelnyxRTC] Network type change detected - triggering proactive reconnection');
        this.onNetworkAvailable();
      } else if (!state.isInternetReachable && !this.reconnecting) {
        log.debug('[TelnyxRTC] Network type change led to loss of connectivity - starting reconnection process');
        this.onNetworkUnavailable();
      } else if (state.isInternetReachable) {
        log.debug('[TelnyxRTC] Network type change detected - simulating brief network loss for reconnection');
         this.onNetworkUnavailable();
         setTimeout(() => {
           this.onNetworkAvailable();
         }, 1500); // 1.5 seconds delay
      }
  }

  /**
   * Handles network becoming unavailable
   * Matches Android SDK behavior: disconnect calls and start reconnection
   */
  private onNetworkUnavailable() {

    if (this.reconnecting) {
      log.debug('[TelnyxRTC] Already in reconnection process, ignoring network unavailable event');
      return;
    }

    log.debug('[TelnyxRTC] Network unavailable - starting reconnection process');
    this.reconnecting = true;

    // Disconnect active calls (similar to Android SDK)
    if (this.call && this.call.state !== 'ended' && this.call.state !== 'dropped') {
      log.debug('[TelnyxRTC] Updating call state to dropped due to network loss');
      // Update call state to indicate network issues - set to dropped since call is lost due to network
      this.call.setDropped();
      log.debug('[TelnyxRTC] Call state updated to dropped due to network disconnection');
    }


    // Start reconnection timeout timer
    this.startReconnectionTimer();

    // Disconnect existing connection (this clears the connection and handlers)
    this.disconnect(true);
    this.call?.disposePeer();

  }

  /**
   * Handles network becoming available
   * Triggers immediate reconnection attempt
   */
  private onNetworkAvailable() {
    log.debug('[TelnyxRTC] Network available - attempting immediate reconnection');
    this.attemptReconnection();
  }

  /**
   * Attempts to reconnect to the socket and relogin
   * disconnect -> connect -> login
   */
  private async attemptReconnection() {
    if (!this.reconnecting) {
      log.debug('[TelnyxRTC] Not in reconnection state, skipping reconnection attempt');
      return;
    }

    this.reconnecting = false;


    try {
      log.debug('[TelnyxRTC] Starting reconnection process...');

      // Connect (this will create new connection and login)
      await this.connect();

      log.debug('[TelnyxRTC] Reconnection and relogin successful');
      this.cancelReconnectionTimer();

      // If there was an active call, the attach message will be handled in onAttachReceived
      log.debug('[TelnyxRTC] Waiting for attach message to reestablish call...');

    } catch (error) {
      log.error('[TelnyxRTC] Reconnection attempt failed:', error);
    }
  }

  /**
   * Starts the reconnection timeout timer
   */
  private startReconnectionTimer() {
    log.debug('[TelnyxRTC] Starting reconnection timeout timer');
    this.cancelReconnectionTimer();

    this.reconnectionTimeoutHandle = setTimeout(() => {
      if (this.reconnecting) {
        log.error('[TelnyxRTC] Reconnection timeout reached');
        this.reconnecting = false;

        // Update call state to indicate timeout
        if (this.call && this.call.state !== 'ended') {
          log.debug('[TelnyxRTC] Setting call to failed state due to reconnection timeout');
          // Call will handle the timeout state
        }
      }
    }, TelnyxRTC.RECONNECT_TIMEOUT);
  }

  /**
   * Cancels the reconnection timeout timer
   */
  private cancelReconnectionTimer() {
    if (this.reconnectionTimeoutHandle) {
      clearTimeout(this.reconnectionTimeoutHandle);
      this.reconnectionTimeoutHandle = null;
    }
  }

  /**
   * Set a call to connecting state (used for push notification calls when answered via CallKit)
   * @param callId The ID of the call to set to connecting state
   */
  public setCallConnecting(callId: string): void {
    if (this.call && this.call.callId === callId) {
      log.debug('[TelnyxRTC] Setting call to connecting state:', callId);
      this.call.setConnecting();
    } else {
      log.warn('[TelnyxRTC] Could not find call to set connecting:', callId);
    }
  }
}
