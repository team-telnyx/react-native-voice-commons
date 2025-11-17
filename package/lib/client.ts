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
import type { InviteEvent } from './messages/call';
import { createInviteAckMessage, isInviteEvent } from './messages/call';
import { createAttachCallMessage } from './messages/attach';
import type { AttachEvent } from './messages/attach';
import { isAttachEvent } from './messages/attach';
import { isValidGatewayStateResponse } from './messages/gateway';

type TelnyxRTCEvents = {
  'telnyx.client.ready': () => void;
  'telnyx.client.error': (error: Error) => void;
  'telnyx.call.incoming': (call: Call, msg: InviteEvent) => void;
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
  private credentialSessionConfig: any = null; // Store login credentials for reconnection
  private tokenSessionConfig: any = null; // Store login token for reconnection
  private reconnectionTimeoutHandle: any = null;
  private static readonly RECONNECT_DELAY = 3000; // 3 seconds
  private static readonly RECONNECT_TIMEOUT = 30000; // 30 seconds

  // Push notification support
  private isCallFromPush: boolean = false;
  private pushNotificationPayload: any = null;
  private pendingInvite: InviteEvent | null = null;

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

    this.netInfoSubscription = NetInfo.addEventListener(this.onNetInfoStateChange);
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
  public disconnect() {
    if (!this.connection) {
      log.warn('No connection exists.');
      return;
    }

    // Cancel any ongoing reconnection process
    this.reconnecting = false;
    this.cancelReconnectionTimer();

    // Clear stored configurations
    this.credentialSessionConfig = null;
    this.tokenSessionConfig = null;

    this.connection.close();
    this.connection = null;
    this.removeAllListeners();
    this.netInfoSubscription?.();

    // Clear push-specific voice_sdk_id on disconnect to ensure clean state
    if ((this as any)._pushVoiceSDKId) {
      log.debug('[TelnyxRTC] Clearing push voice_sdk_id on disconnect');
      (this as any)._pushVoiceSDKId = null;
    }

    // Reset push flags on disconnect to ensure clean state for next connection
    this.isCallFromPush = false;
    this.pushNotificationPayload = null;
    this.pendingInvite = null;
    this.pushNotificationCallKitUUID = null;
    log.debug('[TelnyxRTC] Reset push flags on disconnect');

    // Clear stored push state from AsyncStorage
    this.clearPushState().catch((error) => {
      log.error('[TelnyxRTC] Failed to clear push state on disconnect:', error);
    });

    log.warn('[TelnyxRTC] Disconnected from Telnyx RTC');
  }

  public get connected() {
    return this.connection !== null && this.connection.isConnected;
  }

  private sendAttachCall = async () => {
    if (!this.connection) {
      log.error('[TelnyxRTC] Cannot send attach call without connection');
      return;
    }

    log.debug('[TelnyxRTC] Sending attach call message for push notification');
    const attachMessage = createAttachCallMessage(this.pushNotificationPayload);

    try {
      this.connection.send(attachMessage);
      log.debug('[TelnyxRTC] Attach call message sent successfully');
    } catch (error) {
      log.error('[TelnyxRTC] Failed to send attach call message:', error);
    }
  };

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

    // Check if this is an invite message that's not being detected
    if (msg && typeof msg === 'object' && (msg as any).method === 'telnyx_rtc.invite') {
      log.warn('[TelnyxRTC] Received invite message but isInviteEvent returned false:', msg);
    }

    log.debug('[TelnyxRTC] Message not processed as invite or attach');
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
    this.call = await Call.createInboundCall({
      connection: this.connection,
      remoteSDP: msg.params.sdp,
      sessionId: this.sessionId,
      callId: msg.params.callID,
      telnyxLegId: msg.params.telnyx_leg_id,
      telnyxSessionId: msg.params.telnyx_session_id,
      options: { destinationNumber: msg.params.caller_id_number },
      inviteCustomHeaders: msg.params.dialogParams?.custom_headers || null,
    });

    // Set call state to connecting after creation
    (this.call as any).state = 'connecting';
    this.call.emit('telnyx.call.state', this.call, 'connecting');
    log.debug('[TelnyxRTC] Call state set to connecting after creation');

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
    const attachCall = await Call.createInboundCall({
      connection: this.connection,
      remoteSDP: msg.params.sdp,
      sessionId: this.sessionId,
      callId: msg.params.callID,
      telnyxLegId: msg.params.telnyx_leg_id,
      telnyxSessionId: msg.params.telnyx_session_id,
      options: { 
        destinationNumber: msg.params.caller_id_number 
      },
      inviteCustomHeaders: msg.params.dialogParams?.custom_headers || null,
    });

    // Set the new call object and set state to active (like Android SDK)
    this.call = attachCall;
    
    this.call.answerAttach(); // Auto-answer the attached call
    // Android SDK sets call state to ACTIVE after attach received
    (attachCall as any).state = 'active';
    attachCall.emit('telnyx.call.state', attachCall, 'active');
    
    log.debug('[TelnyxRTC] Call reattached successfully and set to active state');

    // Emit event to notify that the call has been reestablished
    this.emit('telnyx.call.incoming', this.call, msg as any);

    eventBus.emit('telnyx.notification', {
      type: 'callUpdate',
      call: this.call,
    });

    log.debug('[TelnyxRTC] ====== CALL ATTACH HANDLING COMPLETE ======');
  };

  private onNetInfoStateChange = (state: NetInfoState) => {
    log.debug(`[TelnyxRTC] Network state changed: ${state.isInternetReachable}`);
    
    if (state.isInternetReachable === false) {
      this.onNetworkUnavailable();
    } else if (state.isInternetReachable === true && this.reconnecting) {
      this.onNetworkAvailable();
    }
  };

  /**
   * Handles network becoming unavailable
   * Matches Android SDK behavior: disconnect calls and start reconnection
   */
  private onNetworkUnavailable() {
    log.debug('[TelnyxRTC] Network unavailable - starting reconnection process');
    this.reconnecting = true;

    // Disconnect active calls (similar to Android SDK)
    if (this.call && this.call.state !== 'ended') {
      log.debug('[TelnyxRTC] Updating call state to DROPPED due to network loss');
      // Update call state to indicate network issues
      // The call object will handle the state change
    }

    // Start reconnection timeout timer
    this.startReconnectionTimer();

    // Attempt reconnection after delay to allow network to stabilize
    setTimeout(() => {
      if (this.reconnecting) {
        this.attemptReconnection();
      }
    }, TelnyxRTC.RECONNECT_DELAY);
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
   * Follows Android SDK pattern: disconnect -> connect -> login -> attach calls
   */
  private async attemptReconnection() {
    if (!this.reconnecting) {
      return;
    }

    try {
      log.debug('[TelnyxRTC] Starting reconnection process...');

      // Disconnect existing connection
      if (this.connection) {
        log.debug('[TelnyxRTC] Closing existing connection for reconnection');
        this.connection.close();
        this.connection = null;
      }

      // Stop existing handlers
      this.keepAliveHandler?.stop();
      this.keepAliveHandler = null;
      this.loginHandler = null;

      // Create new connection (similar to Android SDK)
      const pushVoiceSDKId = (this as any)._pushVoiceSDKId;
      if (pushVoiceSDKId) {
        log.debug('[TelnyxRTC] Creating reconnection with push voice_sdk_id:', pushVoiceSDKId);
        this.connection = new Connection(pushVoiceSDKId);
      } else {
        log.debug('[TelnyxRTC] Creating standard reconnection');
        this.connection = new Connection();
      }

      // Store reference to this client in the connection
      this.connection._client = this;

      // Set up connection event listeners
      this.connection.addListener('telnyx.socket.message', this.onSocketMessage);
      this.connection.addListener('telnyx.socket.error', (error) => {
        log.error('[TelnyxRTC] WebSocket reconnection error:', error);
      });

      // Wait for connection to be established
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Reconnection timeout after 15 seconds'));
        }, 15000);

        const onOpen = () => {
          log.debug('[TelnyxRTC] Reconnection WebSocket established');
          clearTimeout(timeout);
          this.connection!.removeListener('telnyx.socket.open', onOpen);
          this.connection!.removeListener('telnyx.socket.error', onError);
          this.connection!.removeListener('telnyx.socket.close', onClose);
          resolve();
        };

        const onError = (error: Event) => {
          log.error('[TelnyxRTC] Reconnection failed:', error);
          clearTimeout(timeout);
          this.connection!.removeListener('telnyx.socket.open', onOpen);
          this.connection!.removeListener('telnyx.socket.error', onError);
          this.connection!.removeListener('telnyx.socket.close', onClose);
          reject(new Error(`Reconnection failed: ${error.type}`));
        };

        const onClose = () => {
          log.debug('[TelnyxRTC] Reconnection closed during attempt');
          clearTimeout(timeout);
          this.connection!.removeListener('telnyx.socket.open', onOpen);
          this.connection!.removeListener('telnyx.socket.error', onError);
          this.connection!.removeListener('telnyx.socket.close', onClose);
          reject(new Error('Reconnection closed unexpectedly'));
        };

        this.connection!.addListener('telnyx.socket.open', onOpen);
        this.connection!.addListener('telnyx.socket.error', onError);
        this.connection!.addListener('telnyx.socket.close', onClose);
      });

      // Set up handlers
      this.loginHandler = new LoginHandler(this.connection);
      this.keepAliveHandler = new KeepAliveHandler(this.connection);
      this.keepAliveHandler.start();

      // Relogin with stored configuration
      log.debug('[TelnyxRTC] Attempting relogin after reconnection...');
      if (this.credentialSessionConfig) {
        // For credential-based login, set attach_call flag
        this.loginHandler.setAttachCall(true);
        this.sessionId = await this.loginHandler.login(this.credentialSessionConfig);
      } else if (this.tokenSessionConfig) {
        // For token-based login, set attach_call flag  
        this.loginHandler.setAttachCall(true);
        this.sessionId = await this.loginHandler.login(this.tokenSessionConfig);
      } else {
        throw new Error('No stored login configuration found for reconnection');
      }

      if (!this.sessionId) {
        throw new Error('Relogin failed after reconnection');
      }

      log.debug('[TelnyxRTC] Reconnection and relogin successful');
      this.reconnecting = false;
      this.cancelReconnectionTimer();

      // If there was an active call, the attach message will be handled in onAttachReceived
      log.debug('[TelnyxRTC] Waiting for attach message to reestablish call...');

    } catch (error) {
      log.error('[TelnyxRTC] Reconnection attempt failed:', error);
      
      // If we have time left, try again
      if (this.reconnecting) {
        setTimeout(() => {
          if (this.reconnecting) {
            this.attemptReconnection();
          }
        }, TelnyxRTC.RECONNECT_DELAY);
      }
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
