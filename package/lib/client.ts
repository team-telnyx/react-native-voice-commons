import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import { EventEmitter } from 'eventemitter3';
import log from 'loglevel';
import uuid from 'uuid-random';
import { Platform } from 'react-native';
import { Call } from './call';
import type { CallRecoveryHooks } from './call';
import { DEFAULT_SIGNALING_HEALTH_MONITOR_CONFIG } from './signaling-health-monitor';
import type { CandidateEvidence } from './signaling-health-monitor';
import type { CallOptions } from './call-options';
import type { ClientOptions } from './client-options';
import type { CallReportConfig } from './call-report-models';
import { DEFAULT_CALL_REPORT_CONFIG } from './call-report-models';
import { Connection } from './connection';
import { DEFAULT_SDK_IDENTITY, type SDKIdentity } from './env';
import { KeepAliveHandler } from './keep-alive-handler';
import { eventBus } from './legacy-event-bus';
import { LoginHandler } from './login-handler';
import type {
  InviteEvent,
  AnswerEvent,
  ByeEvent,
  CallTerminationReason,
  CandidateEvent,
  EndOfCandidatesEvent,
} from './messages/call';
import {
  isInviteEvent,
  isAnswerEvent,
  isByeEvent,
  isCandidateEvent,
  isEndOfCandidatesEvent,
  getCallIdFromTrickleParams,
} from './messages/call';
import { TelnyxRTCMethod } from './messages/methods';
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
  'telnyx.call.remoteEnded': (callId: string, reason: CallTerminationReason) => void;
  'telnyx.call.stateChanged': (call: Call, state: string) => void;
  'telnyx.call.removed': (callId: string) => void;
};

type PendingTrickleEvent =
  | { type: 'candidate'; msg: CandidateEvent; receivedAt: number }
  | { type: 'endOfCandidates'; msg: EndOfCandidatesEvent; receivedAt: number };

export class TelnyxRTC extends EventEmitter<TelnyxRTCEvents> {
  public options: ClientOptions;
  public sessionId: string | null;
  private readonly sdkIdentity: SDKIdentity;

  /**
   * Dictionary of all active calls tracked by their UUIDs.
   * Calls are tracked from creation until they transition to the 'ended' state.
   * This matches the iOS SDK behavior where `calls: [UUID: Call]` is used.
   */
  public calls: Map<string, Call> = new Map();

  /**
   * Store listener references for proper cleanup to prevent memory leaks.
   * Maps call IDs to their state change listener functions.
   */
  private callStateListeners: Map<string, (call: Call, state: string) => void> = new Map();

  /**
   * Returns the current/first active call for backward compatibility.
   * New code should use `calls` Map or `getCall(callId)` instead.
   * @deprecated Use `calls` or `getCall(callId)` for multi-call support
   */
  public get call(): Call | null {
    // Return the first active call (non-ended) or null
    for (const call of this.calls.values()) {
      if (call.state !== 'ended') {
        return call;
      }
    }
    return null;
  }

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
  private confirmedSession?: { id: string; voiceSDKId?: string; pushGeneration?: number };
  private connectionGeneration: number = 0;

  // Active-call ICE restart recovery (VSDK-679)
  // True while a recovery fallback owns the reconnect flow.
  private recoveryReattachActive: boolean = false;
  // Invalidates any pending recovery fallback when the consumer explicitly disconnects.
  private recoveryReattachGeneration: number = 0;
  private explicitDisconnectRequested: boolean = false;
  // One-shot relay-only override captured from the recovering call's stats.
  private recoveryCandidateEvidenceByCallId: Map<string, CandidateEvidence> = new Map();
  private activeCallHealthCheckHandle: ReturnType<typeof setInterval> | null = null;
  private static readonly ACTIVE_CALL_HEALTH_CHECK_MS =
    DEFAULT_SIGNALING_HEALTH_MONITOR_CONFIG.signalingHealthCheckIntervalMs;
  private static readonly RECONNECT_DELAY = 3000; // 3 seconds
  private static readonly RECONNECT_TIMEOUT = 60000; // 30 seconds

  // Push notification support
  private isCallFromPush: boolean = false;
  private pushNotificationPayload: any = null;
  private pendingInvite: InviteEvent | null = null;

  // Early media/ringback support
  private pendingMediaEvents: Map<string, MediaEvent> = new Map();
  private pendingTrickleEvents: Map<string, PendingTrickleEvent[]> = new Map();
  private static readonly PENDING_TRICKLE_TTL_MS = 30000;

  // Pending CallKit actions are keyed by the app-facing CallKit UUID. A
  // singleton flag is unsafe once two calls can coexist because it resolves
  // through `call` (the first non-ended call).
  private pendingAnswerActions: Map<string, Record<string, string>> = new Map();
  private pendingEndActions: Set<string> = new Set();
  private static readonly LEGACY_PENDING_ACTION_KEY = '__legacy_unambiguous_call__';

  private pushGeneration = 0;
  private pushVoiceSDKId?: string;
  private pushConnection: Connection | null = null;
  private pushInviteReserved = false;

  private clearPushContext(generation: number) {
    if (generation !== this.pushGeneration) return;

    const actionKey = this.pushNotificationCallKitUUID;
    if (actionKey) {
      this.pendingAnswerActions.delete(actionKey);
      this.pendingEndActions.delete(actionKey);
    }
    this.pendingAnswerActions.delete(TelnyxRTC.LEGACY_PENDING_ACTION_KEY);
    this.pendingEndActions.delete(TelnyxRTC.LEGACY_PENDING_ACTION_KEY);
    this.pushGeneration += 1;
    this.isCallFromPush = false;
    this.pushNotificationPayload = null;
    this.pushNotificationCallKitUUID = null;
    this.pushVoiceSDKId = undefined;
    this.pushConnection = null;
    this.pushInviteReserved = false;
  }

  constructor(opts: ClientOptions) {
    super();
    this.options = { ...opts };

    if (Boolean(opts.sdkName) !== Boolean(opts.sdkVersion)) {
      throw new Error('[TelnyxRTC] sdkName and sdkVersion must be provided together');
    }
    this.sdkIdentity = Object.freeze(
      opts.sdkName && opts.sdkVersion
        ? { name: opts.sdkName, version: opts.sdkVersion }
        : { ...DEFAULT_SDK_IDENTITY }
    );

    this.connection = null;
    this.sessionId = null;
    this.loginHandler = null;
    this.keepAliveHandler = null;
    // calls Map is initialized in class declaration

    // Pending action collections are initialized in their field declarations.

    // Force debug logging in development or when explicitly requested
    const shouldDebug = __DEV__ || opts.logLevel === 'debug' || (global as any).__TELNYX_DEBUG__;
    const logLevel = shouldDebug ? 'debug' : opts.logLevel || 'warn';
    log.setLevel(logLevel);
    console.log(
      `🔧 TelnyxRTC: Log level set to '${logLevel}' (dev: ${__DEV__}, requested: ${opts.logLevel})`
    );

    // Initialize lastNetworkType with current network state
    try {
      NetInfo.fetch()
        .then((state) => {
          this.lastNetworkType = state.type;
          log.debug('[TelnyxRTC] Initial network type set to:', state.type);
        })
        .catch((error) => {
          log.warn('[TelnyxRTC] Failed to fetch initial network state:', error);
        });

      this.netInfoSubscription = NetInfo.addEventListener(this.onNetInfoStateChange);
    } catch (error) {
      log.warn('[TelnyxRTC] NetInfo not available, network monitoring disabled:', error);
    }
  }

  // ============================================================================
  // MARK: - Call Management (Multi-call support matching iOS SDK)
  // ============================================================================

  /**
   * Access any active call tracked by the SDK.
   * A call will be accessible until it has ended (transitioned to the 'ended' state).
   * This matches the iOS SDK `getCall(callId:)` method.
   *
   * @param callId The unique identifier of a call.
   * @returns The Call object that matches the requested callId, or null if not found.
   * @example
   * ```typescript
   * const call = telnyxRTC.getCall('some-call-uuid');
   * if (call) {
   *   console.log('Call state:', call.state);
   * }
   * ```
   */
  public getCall(callId: string): Call | null {
    return this.calls.get(callId) || null;
  }

  /**
   * Get all active calls as an array.
   * @returns Array of all tracked Call objects
   */
  public getActiveCalls(): Call[] {
    return Array.from(this.calls.values()).filter((call) => call.state !== 'ended');
  }

  /**
   * Check if there are any active calls (not in 'ended' state).
   * Matches iOS SDK `isCallsActive` property.
   */
  public get hasActiveCalls(): boolean {
    for (const call of this.calls.values()) {
      if (call.state !== 'ended') {
        return true;
      }
    }
    return false;
  }

  /**
   * Add a call to the calls dictionary and set up state change listener.
   * @internal
   */
  private addCall(call: Call): void {
    const callId = call.callId;
    log.debug(`[TelnyxRTC] Adding call to tracking: ${callId}`);

    this.calls.set(callId, call);

    const stateListener = (updatedCall: Call, state: string) => {
      log.debug(`[TelnyxRTC] Call ${callId} state changed to: ${state}`);
      this.emit('telnyx.call.stateChanged', updatedCall, state);

      if (state === 'ended') {
        log.debug(`[TelnyxRTC] Call ${callId} ended, removing from tracking`);
        this.removeCall(callId);
      }
    };

    this.callStateListeners.set(callId, stateListener);
    call.on('telnyx.call.state', stateListener);

    this.drainPendingTrickleEvents(callId);
    this.ensureActiveCallHealthCheckTimer();

    log.debug(`[TelnyxRTC] Total calls tracked: ${this.calls.size}`);
  }

  private ensureActiveCallHealthCheckTimer(): void {
    if (this.activeCallHealthCheckHandle || !this.hasActiveCalls) {
      return;
    }
    this.activeCallHealthCheckHandle = setInterval(() => {
      if (!this.hasActiveCalls) {
        this.stopActiveCallHealthCheckTimer();
        return;
      }
      if (this.reconnecting || this.recoveryReattachActive) {
        return;
      }
      if (!this.connection) {
        // Explicit disconnect (or post-recovery-failure teardown): recovery
        // must not restart a session the consumer closed, so stop the
        // monitor; the next addCall after a fresh connect re-arms it.
        this.stopActiveCallHealthCheckTimer();
        return;
      }
      for (const call of this.calls.values()) {
        if (typeof call.checkSignalingHealth === 'function') {
          call.checkSignalingHealth();
        }
      }
    }, TelnyxRTC.ACTIVE_CALL_HEALTH_CHECK_MS);
    (this.activeCallHealthCheckHandle as any)?.unref?.();
  }

  private stopActiveCallHealthCheckTimer(): void {
    if (!this.activeCallHealthCheckHandle) {
      return;
    }
    clearInterval(this.activeCallHealthCheckHandle);
    this.activeCallHealthCheckHandle = null;
  }

  private updateTrackedCallId(previousCallId: string, call: Call): void {
    if (previousCallId === call.callId) {
      this.drainPendingTrickleEvents(call.callId);
      return;
    }

    const previousListener = this.callStateListeners.get(previousCallId);
    if (previousListener) {
      call.off('telnyx.call.state', previousListener);
      this.callStateListeners.delete(previousCallId);
    }
    this.calls.delete(previousCallId);
    this.addCall(call);
  }

  private prunePendingTrickleEvents(): void {
    const expiresBefore = Date.now() - TelnyxRTC.PENDING_TRICKLE_TTL_MS;

    for (const [callId, events] of this.pendingTrickleEvents.entries()) {
      const freshEvents = events.filter((event) => event.receivedAt >= expiresBefore);
      if (freshEvents.length > 0) {
        this.pendingTrickleEvents.set(callId, freshEvents);
      } else {
        this.pendingTrickleEvents.delete(callId);
      }
    }
  }

  private queuePendingTrickleEvent(
    callId: string,
    event: Omit<PendingTrickleEvent, 'receivedAt'>
  ): void {
    this.prunePendingTrickleEvents();

    const pending = this.pendingTrickleEvents.get(callId) || [];
    pending.push({ ...event, receivedAt: Date.now() });
    this.pendingTrickleEvents.set(callId, pending);
  }

  private drainPendingTrickleEvents(callId: string): void {
    const targetCall = this.getCall(callId);
    if (!targetCall) {
      return;
    }

    const pending = this.pendingTrickleEvents.get(callId);
    if (!pending?.length) {
      return;
    }

    this.pendingTrickleEvents.delete(callId);

    const expiresBefore = Date.now() - TelnyxRTC.PENDING_TRICKLE_TTL_MS;
    for (const event of pending) {
      if (event.receivedAt < expiresBefore) {
        continue;
      }

      if (event.type === 'candidate') {
        targetCall.handleRemoteCandidate({
          candidate: event.msg.params.candidate,
          sdpMid: event.msg.params.sdpMid,
          sdpMLineIndex: event.msg.params.sdpMLineIndex,
        });
      } else {
        targetCall.handleRemoteEndOfCandidates();
      }
    }
  }

  /**
   * Remove a call from the calls dictionary and clean up event listeners.
   * @internal
   */
  private removeCall(callId: string): void {
    if (this.calls.has(callId)) {
      const call = this.calls.get(callId);
      const listener = this.callStateListeners.get(callId);

      if (call && listener) {
        call.off('telnyx.call.state', listener);
        this.callStateListeners.delete(callId);
        log.debug(`[TelnyxRTC] Removed state listener for call: ${callId}`);
      }

      log.debug(`[TelnyxRTC] Removing call from tracking: ${callId}`);
      this.calls.delete(callId);
      this.recoveryCandidateEvidenceByCallId.delete(callId);
      this.emit('telnyx.call.removed', callId);
      if (!this.hasActiveCalls) {
        this.stopActiveCallHealthCheckTimer();
      }
      log.debug(`[TelnyxRTC] Total calls tracked: ${this.calls.size}`);
    }
  }

  // ============================================================================
  // MARK: - Call Creation
  // ============================================================================

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

    const newCall = new Call({
      connection: this.connection,
      direction: 'outbound',
      sessionId: this.sessionId,
      telnyxSessionId: null,
      telnyxLegId: null,
      callId: null,
      options: {
        ...options,
        peerConnectionOptions: {
          ...options.peerConnectionOptions,
          // Client-level iceServers serves as the default; an explicit
          // per-call override in peerConnectionOptions.iceServers wins.
          iceServers:
            options.peerConnectionOptions?.iceServers ??
            this.options.iceServers,
        },
      },
      debug: this.options.debug,
      enableQualityMetrics: this.options.enableQualityMetrics,
      callReportConfig: this.getCallReportConfig(),
      pushWhenActive: this.options.pushWhenActive,
      pushDeviceToken: this.options.pushNotificationDeviceToken,
      sdkIdentity: this.sdkIdentity,
      recoveryHooks: this.buildRecoveryHooks(),
    });

    // Add to calls tracking (matches iOS SDK behavior)
    this.addCall(newCall);

    const provisionalCallId = newCall.callId;
    await newCall.invite();
    this.updateTrackedCallId(provisionalCallId, newCall);
    return newCall;
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
    const metadata = pushNotificationPayload?.metadata || pushNotificationPayload;
    const callId = metadata?.call_id || metadata?.callId;
    const callKitUUID = typeof callId === 'string' && callId ? this.normalizeCallIdentity(callId) : null;
    const voiceSDKId = typeof metadata?.voice_sdk_id === 'string'
      ? metadata.voice_sdk_id || undefined
      : undefined;

    if (this.isCallFromPush &&
      (this.pushNotificationCallKitUUID !== callKitUUID || this.pushVoiceSDKId !== voiceSDKId)) {
      this.clearPushContext(this.pushGeneration);
    }
    if (!this.isCallFromPush) this.pushGeneration += 1;
    this.isCallFromPush = true;
    this.pushNotificationCallKitUUID = callKitUUID;
    this.pushVoiceSDKId = voiceSDKId;
    if (this.getActiveCalls().some((call) => call.state === 'active' || call.state === 'held')) {
      this.pushConnection = this.connection;
    }
    this.pushNotificationPayload = {
      ...metadata,
      from_notification: pushNotificationPayload?.from_notification ?? metadata?.from_notification,
      action: pushNotificationPayload?.action ?? metadata?.action,
    };
  }

  /**
   * Queue an answer action for when the call invite arrives (matching iOS SDK behavior)
   * This should be called when the user answers from CallKit before the socket connection is established
   * @param customHeaders Optional custom headers to include with the answer
   */
  public queueAnswerFromCallKit(
    callKitUUIDOrHeaders?: string | Record<string, string>,
    customHeaders: Record<string, string> = {}
  ) {
    const callKitUUID =
      typeof callKitUUIDOrHeaders === 'string'
        ? this.normalizeCallIdentity(callKitUUIDOrHeaders)
        : null;
    const headers =
      callKitUUIDOrHeaders && typeof callKitUUIDOrHeaders !== 'string'
        ? callKitUUIDOrHeaders
        : customHeaders;
    const actionKey = callKitUUID ?? TelnyxRTC.LEGACY_PENDING_ACTION_KEY;
    const targetCall = this.resolveCallKitTarget(callKitUUID, 'ringing');

    if (!callKitUUID && !targetCall && this.getActiveCalls().length > 1) {
      log.warn('[TelnyxRTC] Refusing ambiguous legacy CallKit answer with multiple calls');
      return;
    }

    log.debug('[TelnyxRTC] Queuing answer action from CallKit', { callKitUUID, headers });
    this.pendingEndActions.delete(actionKey);
    this.pendingAnswerActions.set(actionKey, headers);

    if (targetCall) {
      log.debug('[TelnyxRTC] Target call exists, answering immediately:', targetCall.callId);
      void this.executePendingAnswer(targetCall, actionKey);
    } else {
      log.debug('[TelnyxRTC] Target call not yet available; answer remains keyed for its invite');
    }
  }

  /**
   * Queue an end action for when the call invite arrives (matching iOS SDK behavior)
   * This should be called when the user ends from CallKit before the socket connection is established
   */
  public queueEndFromCallKit(callKitUUID?: string) {
    const normalizedUUID = callKitUUID ? this.normalizeCallIdentity(callKitUUID) : null;
    const actionKey = normalizedUUID ?? TelnyxRTC.LEGACY_PENDING_ACTION_KEY;
    const targetCall = this.resolveCallKitTarget(normalizedUUID);

    if (!normalizedUUID && !targetCall && this.getActiveCalls().length > 1) {
      log.warn('[TelnyxRTC] Refusing ambiguous legacy CallKit end with multiple calls');
      return;
    }

    log.debug('[TelnyxRTC] Queuing end action from CallKit', { callKitUUID: normalizedUUID });
    this.pendingAnswerActions.delete(actionKey);
    this.pendingEndActions.add(actionKey);

    if (targetCall) {
      log.debug('[TelnyxRTC] Target call exists, ending immediately:', targetCall.callId);
      this.executePendingEnd(targetCall, actionKey);
    } else {
      log.debug('[TelnyxRTC] Target call not yet available; end remains keyed for its invite');
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
   * Whether a live call with a different signaling ID already owns a CallKit UUID.
   * A reattached call keeps its signaling ID, so it can reclaim its own UUID.
   * @internal
   */
  public isCallKitUUIDOwnedByAnotherCall(uuid: string, callId: string): boolean {
    const normalizedUUID = this.normalizeCallIdentity(uuid);
    for (const call of this.calls.values()) {
      if (
        call.callId !== callId &&
        call.state !== 'ended' &&
        this.getCallKitIdentity(call) === normalizedUUID
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Execute pending answer action
   */
  private async executePendingAnswer(targetCall: Call, actionKey: string) {
    const pendingHeaders = this.pendingAnswerActions.get(actionKey);
    if (!pendingHeaders) {
      return;
    }

    this.pendingAnswerActions.delete(actionKey);
    try {
      log.debug('[TelnyxRTC] Executing pending answer action');

      // Convert Record<string, string> to { name: string; value: string }[] format
      const customHeaders = Object.entries(pendingHeaders).map(([name, value]) => ({
        name,
        value,
      }));

      // Use the answer method with custom headers
      await targetCall.answer(customHeaders);
      log.debug('[TelnyxRTC] Pending answer executed successfully');
    } catch (error) {
      log.error('[TelnyxRTC] Failed to execute pending answer:', error);
    }
  }

  /**
   * Execute pending end action
   */
  private executePendingEnd(targetCall: Call, actionKey: string) {
    if (!this.pendingEndActions.has(actionKey)) {
      return;
    }

    this.pendingEndActions.delete(actionKey);
    try {
      log.debug('[TelnyxRTC] Executing pending end action');
      targetCall.hangup();
      log.debug('[TelnyxRTC] Pending end executed successfully');
    } catch (error) {
      log.error('[TelnyxRTC] Failed to execute pending end:', error);
    }
  }

  private normalizeCallIdentity(callId: string): string {
    return callId.toLowerCase();
  }

  private getCallKitIdentity(call: Call): string {
    const callKitUUID = (call as any)._callKitUUID;
    return this.normalizeCallIdentity(callKitUUID || call.callId);
  }

  private resolveCallKitTarget(callKitUUID: string | null, requiredState?: string): Call | null {
    const candidates = this.getActiveCalls().filter(
      (call) => !requiredState || call.state === requiredState
    );

    if (callKitUUID) {
      return (
        candidates.find((call) => this.getCallKitIdentity(call) === callKitUUID) || null
      );
    }

    return candidates.length === 1 ? candidates[0] : null;
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
  public connect(): Promise<void> {
    return this.connectSession(false);
  }

  private async connectSession(recover: boolean) {
    if (this.connection) {
      log.warn('A connection already exists. Please close it before creating a new one.');
      return;
    }

    const connectionGeneration = (this.connectionGeneration += 1);
    this.explicitDisconnectRequested = false;
    log.debug('[TelnyxRTC] Starting connection process...');

    // Store login configuration for potential reconnection
    if ('login_token' in this.options) {
      this.tokenSessionConfig = this.options;
      log.debug('[TelnyxRTC] Stored token configuration for reconnection');
    } else if ('login' in this.options && 'password' in this.options) {
      this.credentialSessionConfig = this.options;
      log.debug('[TelnyxRTC] Stored credential configuration for reconnection');
    }

    const pushGeneration = this.pushGeneration;
    const fromPush = this.isCallFromPush;
    const pushVoiceSDKId = this.pushVoiceSDKId;
    // A pending push can recover only a session confirmed for that same flow.
    const recovery = recover && this.confirmedSession?.voiceSDKId &&
      (!fromPush || this.confirmedSession.pushGeneration === pushGeneration)
      ? this.confirmedSession
      : undefined;
    if (!recover || !recovery) this.confirmedSession = undefined;
    this.sessionId = null;

    const route = recovery?.voiceSDKId ?? pushVoiceSDKId;
    const connection = new Connection(route, this.options.environment);
    this.connection = connection;
    if (fromPush) this.pushConnection = connection;
    try {
      await this.registerConnection(connection, connectionGeneration, pushGeneration, fromPush, route, recovery?.id);
    } catch (error) {
      if (this.connectionGeneration === connectionGeneration) {
        this.connectionGeneration += 1;
        this.clearPushContext(pushGeneration);
        this.closeConnection();
      }
      throw error;
    }
  }

  private async registerConnection(
    connection: Connection,
    connectionGeneration: number,
    pushGeneration: number,
    fromPush: boolean,
    route: string | undefined,
    recoverySessionId?: string
  ) {
    connection._client = this;
    const isCurrent = () => this.connectionGeneration === connectionGeneration;
    connection.addListener('telnyx.socket.message', (message) => {
      if (isCurrent()) return this.onSocketMessage(message);
    });
    const onSocketFailure = (error: Error) => {
      if (!isCurrent()) return;
      if (this.pushConnection === connection) this.clearPushContext(this.pushGeneration);
      if (this.sessionId) {
        try {
          this.emit('telnyx.client.error', error);
        } catch (listenerError) {
          log.error('[TelnyxRTC] Client error listener failed:', listenerError);
        }
      }
    };
    connection.addListener('telnyx.socket.error', (error) => {
      onSocketFailure(new Error(`WebSocket connection failed: ${error.type}`));
    });
    connection.addListener('telnyx.socket.close', () => {
      onSocketFailure(new Error('WebSocket closed'));
    });

    if (!connection.isConnected) {
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timeout);
          connection.removeListener('telnyx.socket.open', onOpen);
          connection.removeListener('telnyx.socket.error', onError);
          connection.removeListener('telnyx.socket.close', onClose);
        };
        const fail = (error: Error) => {
          cleanup();
          reject(error);
        };
        const onOpen = () => {
          cleanup();
          resolve();
        };
        const onError = (error: Event) => fail(new Error(`WebSocket connection failed: ${error.type}`));
        const onClose = () => fail(new Error('WebSocket connection closed unexpectedly'));
        const timeout = setTimeout(() => fail(new Error('WebSocket connection timeout after 15 seconds')), 15000);
        connection.addListener('telnyx.socket.open', onOpen);
        connection.addListener('telnyx.socket.error', onError);
        connection.addListener('telnyx.socket.close', onClose);
      });
    }

    this.throwIfConnectCanceled(connectionGeneration);
    if (fromPush && this.pushGeneration !== pushGeneration) {
      throw new Error('VoIP push was superseded before login');
    }

    this.loginHandler = new LoginHandler(connection, this.sdkIdentity);
    this.keepAliveHandler = new KeepAliveHandler(connection);
    this.keepAliveHandler.start();

    const registeredSession = await this.loginHandler.login(
      this.options,
      (id) => {
        // ATTACH can arrive between the login reply and REGED.
        if (isCurrent()) this.sessionId = id;
      },
      { fromPush, sessionId: recoverySessionId }
    );
    this.throwIfConnectCanceled(connectionGeneration);
    if (!registeredSession?.id) {
      throw new Error('Login failed. Please check your credentials and try again.');
    }
    this.sessionId = registeredSession.id;
    this.confirmedSession = {
      id: registeredSession.id,
      voiceSDKId:
        typeof registeredSession.voiceSDKId === 'string' && registeredSession.voiceSDKId
          ? registeredSession.voiceSDKId
          : route,
      pushGeneration: fromPush ? pushGeneration : undefined,
    };

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

    this.throwIfConnectCanceled(connectionGeneration);
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
    this.connectionGeneration += 1;

    if (!fromReconnection) {
      this.stopActiveCallHealthCheckTimer();
      for (const call of this.calls.values()) {
        call.cancelRecovery('client-disconnect');
      }
      this.recoveryReattachGeneration += 1;
      this.explicitDisconnectRequested = true;
      this.recoveryReattachActive = false;
      this.reconnecting = false;
    }

    this.cancelReconnectionTimer();

    // Clear stored configurations
    this.credentialSessionConfig = null;
    this.tokenSessionConfig = null;

    this.closeConnection();

    if (!fromReconnection) {
      this.confirmedSession = undefined;
      this.clearPushContext(this.pushGeneration);
      this.pendingAnswerActions.clear();
      this.pendingEndActions.clear();
      this.removeAllListeners();
      try {
        this.netInfoSubscription?.();
      } catch (error) {
        log.warn('[TelnyxRTC] NetInfo subscription cleanup failed:', error);
      }
    }

    log.warn('[TelnyxRTC] Disconnected from Telnyx RTC');
  }

  private closeConnection() {
    const connection = this.connection;
    this.connection = null;
    this.sessionId = null;
    this.pendingInvite = null;
    this.pushInviteReserved = false;
    this.loginHandler?.cancelPendingLogin();
    this.loginHandler = null;
    this.keepAliveHandler?.stop();
    this.keepAliveHandler = null;
    connection?.close();
  }

  public get connected() {
    return this.connection !== null && this.connection.isConnected;
  }

  private throwIfConnectCanceled(connectionGeneration: number) {
    if (this.connectionGeneration !== connectionGeneration) {
      throw new Error('TelnyxRTC connection has been canceled');
    }
  }

  /**
   * Returns true only if the socket both claims to be connected AND has seen
   * live traffic within `maxIdleMs`. A socket that's idle longer than that
   * cannot be trusted after an iOS app freeze — the kernel may have killed
   * the TLS session without notifying the JS layer. Callers should treat a
   * non-fresh connection as dead and force a reconnect.
   */
  public isFresh(maxIdleMs: number = 30000): boolean {
    if (!this.connection || !this.connection.isConnected) return false;
    return this.connection.idleMs < maxIdleMs;
  }

  /**
   * Exposes the socket's idle duration for diagnostics / logging.
   */
  public get connectionIdleMs(): number {
    return this.connection ? this.connection.idleMs : Infinity;
  }

  private onSocketMessage = (msg: unknown) => {
    log.debug('[TelnyxRTC] Processing socket message:', msg);

    if (isByeEvent(msg)) {
      const reason = this.getCallTerminationReason(msg);
      const targetCall = this.getCall(msg.params.callID);
      if (targetCall) {
        // Match the native SDKs' client-level remote-ended callback. The Call
        // object will still consume this BYE and transition to `ended`.
        this.emit('telnyx.call.remoteEnded', this.getCallKitIdentity(targetCall), reason);
      } else {
        // A push can wake the app after the caller has already hung up. In
        // that race no Call object exists to consume the BYE.
        return this.handleRemoteCallEndedWithoutCall(msg, reason);
      }
    }

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

    if (isCandidateEvent(msg)) {
      log.debug('[TelnyxRTC] Detected ICE candidate event, processing...');
      return this.handleCandidateEvent(msg);
    }

    if (isEndOfCandidatesEvent(msg)) {
      log.debug('[TelnyxRTC] Detected end-of-candidates event, processing...');
      return this.handleEndOfCandidatesEvent(msg);
    }

    // Check if this is an invite message that's not being detected
    if (msg && typeof msg === 'object' && (msg as any).method === TelnyxRTCMethod.INVITE) {
      log.warn('[TelnyxRTC] Received invite message but isInviteEvent returned false:', msg);
    }

    return;
  };

  private getCallTerminationReason = (msg: ByeEvent): CallTerminationReason => ({
    cause: msg.params.cause,
    causeCode: msg.params.causeCode,
    sipCode: msg.params.sipCode,
    sipReason: msg.params.sipReason,
    sipCallId: msg.params.sip_call_id,
  });

  private handleRemoteCallEndedWithoutCall = (
    msg: ByeEvent,
    reason: CallTerminationReason
  ) => {
    const callKitUUID = this.pushNotificationCallKitUUID;
    const pushVoiceSDKId = this.pushVoiceSDKId;

    // Unknown BYEs can belong to calls from an earlier socket session. Only
    // bridge the event while an explicit PushKit call is awaiting its INVITE.
    if (!this.isCallFromPush || !callKitUUID) {
      log.debug('[TelnyxRTC] Ignoring BYE without a matching pre-INVITE push context', {
        callID: msg.params.callID,
      });
      return;
    }

    if (
      typeof pushVoiceSDKId === 'string' &&
      typeof msg.voice_sdk_id === 'string' &&
      pushVoiceSDKId !== msg.voice_sdk_id
    ) {
      log.debug('[TelnyxRTC] Ignoring pre-INVITE BYE from another push session', {
        callID: msg.params.callID,
      });
      return;
    }

    log.debug('[TelnyxRTC] Push call ended before INVITE arrived', {
      callID: msg.params.callID,
      callKitUUID,
      cause: msg.params.cause,
      causeCode: msg.params.causeCode,
    });

    if (this.pendingInvite?.params.callID === msg.params.callID) {
      this.pendingInvite = null;
    }
    this.pendingMediaEvents.delete(msg.params.callID);
    this.pendingTrickleEvents.delete(msg.params.callID);

    this.clearPushContext(this.pushGeneration);
    this.emit('telnyx.call.remoteEnded', callKitUUID, reason);
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
      return;
    }

    log.debug('[TelnyxRTC] Session ID available, processing invite immediately');
    await this.processInvite(msg);
  };

  private processInvite = async (msg: InviteEvent) => {
    log.debug('[TelnyxRTC] Processing invite with session ID:', this.sessionId);

    const pushGeneration = this.pushGeneration;
    const connectionGeneration = this.connectionGeneration;
    // Reserve the push before constructing the call. Keep its context visible
    // to native action handlers until the owning INVITE finishes.
    const ownsPush =
      this.isCallFromPush &&
      this.pushConnection === this.connection &&
      !this.pushInviteReserved &&
      (!this.pushNotificationCallKitUUID ||
        !this.isCallKitUUIDOwnedByAnotherCall(this.pushNotificationCallKitUUID, msg.params.callID));
    if (ownsPush) this.pushInviteReserved = true;

    // Check if we have SDP from invite or from a pending media event
    let remoteSDP = msg.params.sdp;
    const pendingMediaEvent = this.pendingMediaEvents.get(msg.params.callID);

    if (!remoteSDP && pendingMediaEvent?.params.sdp) {
      log.debug('[TelnyxRTC] Using SDP from pending media event for early media/ringback');
      remoteSDP = pendingMediaEvent.params.sdp;
    }

    if (!remoteSDP) {
      log.warn(
        '[TelnyxRTC] No SDP available from invite or media event - call may not have early media'
      );
      // Use empty SDP as fallback - peer connection will handle this gracefully
      remoteSDP = '';
    }

    let incomingCall: Call;
    try {
      incomingCall = await Call.createInboundCall({
        connection: this.connection!,
        remoteSDP,
        pushCallKitUUID: ownsPush ? this.pushNotificationCallKitUUID : null,
        sessionId: this.sessionId!,
        callId: msg.params.callID,
        telnyxLegId: msg.params.telnyx_leg_id,
        telnyxSessionId: msg.params.telnyx_session_id,
        options: {
          destinationNumber: msg.params.caller_id_number,
          peerConnectionOptions: {
            useTrickleIce: this.options.useTrickleIce,
            iceServers: this.options.iceServers,
          },
        },
        inviteCustomHeaders: msg.params.dialogParams?.custom_headers || null,
        debug: this.options.debug,
        enableQualityMetrics: this.options.enableQualityMetrics,
        callReportConfig: this.getCallReportConfig(),
        pushWhenActive: this.options.pushWhenActive,
        pushDeviceToken: this.options.pushNotificationDeviceToken,
        sdkIdentity: this.sdkIdentity,
        recoveryHooks: this.buildRecoveryHooks(),
      });
    } catch (error) {
      log.error('[TelnyxRTC] Failed to create inbound call:', error);
      if (ownsPush && connectionGeneration === this.connectionGeneration) {
        this.clearPushContext(pushGeneration);
      }
      return;
    }

    // Add to calls tracking (matches iOS SDK behavior)
    if (connectionGeneration !== this.connectionGeneration) {
      incomingCall.disposePeer();
      return;
    }

    this.addCall(incomingCall);

    log.debug('[TelnyxRTC] Call state set to connecting after creation');

    // Clean up the pending media event since we've processed it
    if (pendingMediaEvent) {
      this.pendingMediaEvents.delete(msg.params.callID);
      log.debug('[TelnyxRTC] Cleaned up pending media event for call:', msg.params.callID);
    }

    log.debug('[TelnyxRTC] Call object created, checking for pending actions');

    // Set when a push action (`reject` / pendingEndAction) caused us to
    // hang up the incoming call before surfacing it. Used to suppress the
    // `telnyx.call.incoming` emission below — otherwise the consumer briefly
    // sees an "incoming" call that's already in `ended` state, flashing a
    // ringing screen for a call that's already dead.
    let rejectedByPushAction = false;

    if (ownsPush && pushGeneration === this.pushGeneration) {
      const { from_notification, action } = this.pushNotificationPayload;
      const callIdentity = this.getCallKitIdentity(incomingCall);
      if (this.pendingAnswerActions.has(callIdentity)) {
        void this.executePendingAnswer(incomingCall, callIdentity);
      } else if (this.pendingEndActions.has(callIdentity)) {
        this.executePendingEnd(incomingCall, callIdentity);
        rejectedByPushAction = true;
      } else if (from_notification && action === 'answer') {
        void incomingCall.answer().catch((error) => {
          log.error('[TelnyxRTC] Failed to answer from push notification:', error);
        });
      } else if (from_notification && action === 'reject') {
        incomingCall.hangup();
        rejectedByPushAction = true;
      } else {
        const legacyKey = TelnyxRTC.LEGACY_PENDING_ACTION_KEY;
        if (this.pendingAnswerActions.has(legacyKey)) {
          void this.executePendingAnswer(incomingCall, legacyKey);
        } else if (this.pendingEndActions.has(legacyKey)) {
          this.executePendingEnd(incomingCall, legacyKey);
          rejectedByPushAction = true;
        }
      }
      this.clearPushContext(pushGeneration);
    }

    if (rejectedByPushAction) {
      log.debug('[TelnyxRTC] Suppressing telnyx.call.incoming for call rejected via push action');
      return;
    }

    log.debug('[TelnyxRTC] Emitting telnyx.call.incoming event');
    this.emit('telnyx.call.incoming', incomingCall, msg);

    log.debug('[TelnyxRTC] Emitting legacy event bus notification');
    eventBus.emit('telnyx.notification', {
      type: 'callUpdate',
      call: incomingCall,
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

    const connectionGeneration = this.connectionGeneration;
    if (!this.sessionId) {
      log.error('[TelnyxRTC] No session ID available for attach.');
      return;
    }

    // Reset reconnecting state (like Android SDK onAttachReceived)
    this.reconnecting = false;
    this.cancelReconnectionTimer();

    log.debug('[TelnyxRTC] Creating new call object from attach message');

    // Create new inbound call from attach message (like Android SDK)
    const attachedCall = await Call.createInboundCall({
      connection: this.connection!,
      remoteSDP: msg.params.sdp,
      pushCallKitUUID: null,
      sessionId: this.sessionId!,
      callId: msg.params.callID,
      telnyxLegId: msg.params.telnyx_leg_id,
      telnyxSessionId: msg.params.telnyx_session_id,
      options: {
        destinationNumber: msg.params.caller_id_number,
        peerConnectionOptions: {
          useTrickleIce: this.options.useTrickleIce,
          iceServers: this.options.iceServers,
          // One-shot relay-only override (VSDK-679): when the pre-failure
          // candidate evidence explicitly reports a VPN, force the replacement
          // call's media through a TURN relay once, then clear the evidence so
          // normal reattaches are not affected.
          ...(this.consumeRelayOverride(msg.params.callID) ? { iceTransportPolicy: 'relay' as const } : {}),
        },
      },
      inviteCustomHeaders: msg.params.dialogParams?.custom_headers || null,
      initialState: 'connecting', // Set initial state to connecting
      debug: this.options.debug,
      enableQualityMetrics: this.options.enableQualityMetrics,
      callReportConfig: this.getCallReportConfig(),
      pushWhenActive: this.options.pushWhenActive,
      pushDeviceToken: this.options.pushNotificationDeviceToken,
      sdkIdentity: this.sdkIdentity,
      recoveryHooks: this.buildRecoveryHooks(),
    });

    if (connectionGeneration !== this.connectionGeneration) {
      attachedCall.disposePeer();
      return;
    }

    // Add to calls tracking (matches iOS SDK behavior)
    this.addCall(attachedCall);

    try {
      await attachedCall.answerAttach();
      log.debug('[TelnyxRTC] AnswerAttach completed successfully');
    } catch (error) {
      log.error('[TelnyxRTC] Failed to execute answerAttach:', error);
      attachedCall.disposePeer();
      if (connectionGeneration !== this.connectionGeneration || this.getCall(attachedCall.callId) !== attachedCall) return;
      this.removeCall(attachedCall.callId);
      this.emit(
        'telnyx.client.error',
        error instanceof Error ? error : new Error(String(error))
      );
      return;
    }

    if (connectionGeneration !== this.connectionGeneration || this.getCall(attachedCall.callId) !== attachedCall) return;

    log.debug('[TelnyxRTC] Emitting telnyx.call.reattached event for reattached call');
    log.debug(
      '[TelnyxRTC] Listeners for telnyx.call.reattached:',
      this.listenerCount('telnyx.call.reattached')
    );
    this.emit('telnyx.call.reattached', attachedCall, msg);

    log.debug('[TelnyxRTC] Emitting legacy event bus notification for reattached call');
    eventBus.emit('telnyx.notification', {
      type: 'callUpdate',
      call: attachedCall,
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

    // Look up the call by ID from our calls dictionary
    const targetCall = this.getCall(callID);
    if (targetCall) {
      log.debug('[TelnyxRTC] Found call in tracking, applying media changes');

      // If media event has SDP, handle early media setup
      if (sdp) {
        log.debug('[TelnyxRTC] Media event contains SDP - setting up early media/ringback');
        targetCall.handleEarlyMedia(sdp);
      }

      // Apply audio/video changes if specified
      if (audio !== undefined || video !== undefined) {
        targetCall.handleMediaUpdate({
          audio,
          video,
          target,
        });
      }
    } else {
      log.debug('[TelnyxRTC] No call found for callID, storing media event for later processing');
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

    // Look up the call by ID from our calls dictionary
    const targetCall = this.getCall(callID);
    if (targetCall) {
      log.debug('[TelnyxRTC] Found call in tracking, processing answer');

      // Store custom headers from the ANSWER message
      targetCall.answerCustomHeaders = msg.params.dialogParams?.custom_headers || null;

      // Extract Telnyx IDs from answer event params (for outbound flows)
      if (msg.params.telnyx_call_control_id) {
        targetCall.telnyxCallControlId = msg.params.telnyx_call_control_id;
      }
      if (msg.params.telnyx_leg_id) {
        targetCall.telnyxLegId = msg.params.telnyx_leg_id;
      }
      if (msg.params.telnyx_session_id) {
        targetCall.telnyxSessionId = msg.params.telnyx_session_id;
      }

      // If answer event has SDP, set it as remote description
      if (sdp) {
        log.debug('[TelnyxRTC] Answer event contains SDP - setting as remote description');
        targetCall.handleRemoteAnswer(sdp);
      } else {
        log.debug('[TelnyxRTC] Answer event has no SDP - assuming SDP was handled via media event');
      }

      // Transition call to active state
      log.debug('[TelnyxRTC] Setting call state to active');
      targetCall.setActive();

      // Emit the answer event for applications to handle
      log.debug('[TelnyxRTC] Emitting telnyx.call.answered event');
      this.emit('telnyx.call.answered', targetCall, msg);
    } else {
      log.warn('[TelnyxRTC] No call found for callID in answer event');
    }

    if (msg.id != null) {
      this.connection.send({
        id: msg.id,
        jsonrpc: '2.0',
        result: { method: 'telnyx_rtc.answer' },
      });
    }

    log.debug('[TelnyxRTC] ====== CALL ANSWER HANDLING COMPLETE ======');
  };

  private handleCandidateEvent = (msg: CandidateEvent) => {
    const callID = getCallIdFromTrickleParams(msg.params);
    if (!callID) {
      log.warn('[TelnyxRTC] Candidate event missing call ID');
      return;
    }

    const targetCall = this.getCall(callID);
    if (!targetCall) {
      log.debug('[TelnyxRTC] Queueing ICE candidate event until call is tracked');
      this.queuePendingTrickleEvent(callID, { type: 'candidate', msg });
      return;
    }

    targetCall.handleRemoteCandidate({
      candidate: msg.params.candidate,
      sdpMid: msg.params.sdpMid,
      sdpMLineIndex: msg.params.sdpMLineIndex,
    });
  };

  private handleEndOfCandidatesEvent = (msg: EndOfCandidatesEvent) => {
    const callID = getCallIdFromTrickleParams(msg.params);
    if (!callID) {
      log.warn('[TelnyxRTC] End-of-candidates event missing call ID');
      return;
    }

    const targetCall = this.getCall(callID);
    if (!targetCall) {
      log.debug('[TelnyxRTC] Queueing end-of-candidates event until call is tracked');
      this.queuePendingTrickleEvent(callID, { type: 'endOfCandidates', msg });
      return;
    }

    targetCall.handleRemoteEndOfCandidates();
  };

  private onNetInfoStateChange = (state: NetInfoState) => {
    log.debug(`[TelnyxRTC] Network state changed:`, {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
      details: state.details,
    });

    // Handle complete network loss
    if (state.isInternetReachable === false || state.isConnected === false) {
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
      log.debug(
        '[TelnyxRTC] Network type change led to loss of connectivity - starting reconnection process'
      );
      this.onNetworkUnavailable();
    } else if (state.isInternetReachable) {
      log.debug(
        '[TelnyxRTC] Network type change detected - simulating brief network loss for reconnection'
      );
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
    // Update all active calls to dropped state due to network loss
    // Use Array.from to avoid mutation during iteration
    for (const call of Array.from(this.calls.values())) {
      if (call.state !== 'ended' && call.state !== 'dropped') {
        log.debug(`[TelnyxRTC] Updating call ${call.callId} state to dropped due to network loss`);
        call.setDropped();
      }
    }

    // Start reconnection timeout timer
    this.startReconnectionTimer();

    // Disconnect existing connection (this clears the connection and handlers)
    this.disconnect(true);

    // Dispose peer connections for all tracked calls
    // Use Array.from to avoid mutation during iteration
    for (const call of Array.from(this.calls.values())) {
      call.disposePeer();
    }
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
      await this.connectSession(true);

      log.debug('[TelnyxRTC] Reconnection and relogin successful');
      this.cancelReconnectionTimer();

      // If there was an active call, the attach message will be handled in onAttachReceived
      log.debug('[TelnyxRTC] Waiting for attach message to reestablish call...');
    } catch (error) {
      log.error('[TelnyxRTC] Reconnection attempt failed:', error);
    }
  }

  // --- Active-call ICE restart recovery (VSDK-679) ---

  /**
   * Recovery hooks injected into every call created by this client.
   * They let the per-call recovery coordinator see client reconnect state,
   * request the one reconnect/register/reattach fallback, and hand over the
   * one-shot relay override captured from the recovering call's stats.
   */
  private buildRecoveryHooks(): CallRecoveryHooks {
    return {
      isClientReconnecting: () => this.reconnecting || this.recoveryReattachActive,
      performReattachFallback: (callId: string) =>
        this.performReattachFallbackForRecovery(callId),
      captureCandidateEvidence: (evidence: CandidateEvidence) => {
        if (evidence.callId) {
          this.recoveryCandidateEvidenceByCallId.set(evidence.callId, evidence);
        }
      },
    };
  }

  /**
   * Consume the one-shot relay override captured during recovery. Returns
   * true only when the pre-failure candidate evidence explicitly reports a
   * VPN network; without evidence recovery fails closed (no override).
   */
  private consumeRelayOverride(callId: string): boolean {
    const evidence = this.recoveryCandidateEvidenceByCallId.get(callId);
    this.recoveryCandidateEvidenceByCallId.delete(callId);

    if (evidence?.localNetworkType === 'vpn' && evidence.localCandidateType !== 'relay') {
      log.debug(
        '[TelnyxRTC] Applying one-shot relay-only override to reattached call (VPN evidence)'
      );
      return true;
    }
    return false;
  }

  private failRecoveryReattach(callId: string, recoveringCall?: Call): void {
    const call = recoveringCall ?? this.calls.get(callId);
    if (!call) {
      return;
    }
    log.warn(`[TelnyxRTC] Recovery fallback exhausted for call ${callId}`);
    call.setDropped();
    if (this.calls.get(callId) === call) {
      this.removeCall(callId);
    }
    this.emit('telnyx.client.error', new Error(`Recovery reattach failed for call ${callId}`));
  }

  /**
   * Client-owned fallback for a failed ICE restart recovery: one
   * reconnect/register/reattach cycle, mirroring onNetworkUnavailable's
   * teardown. Resolves `true` only when the backend attach for the
   * recovering call (`callId`) was received within the reconnection window
   * (replacement call initiated); an attach for any other call is ignored.
   */
  private performReattachFallbackForRecovery(callId: string): Promise<boolean> {
    if (this.recoveryReattachActive || this.reconnecting || this.explicitDisconnectRequested) {
      log.debug('[TelnyxRTC] Recovery fallback skipped: a reconnect flow is already running or disconnected');
      return Promise.resolve(false);
    }

    const recoveryGeneration = this.recoveryReattachGeneration;
    // Keep the original Call as the reporting owner. A successful ATTACH
    // replaces the entry in `calls`, while disposePeer() deliberately cancels
    // this Call's recovery monitor before the client-owned attempt settles.
    const recoveringCall = this.calls.get(callId);
    this.recoveryReattachActive = true;
    // Reuse the existing reconnect-flow guard semantics: keeps push flags and
    // listeners intact while the teardown runs, and signals reconnecting to
    // any other call's recovery coordinator for the duration of the window.
    this.reconnecting = true;

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const isCurrent = () =>
        !this.explicitDisconnectRequested &&
        recoveryGeneration === this.recoveryReattachGeneration;
      // Only the recovering call's replacement attach settles the fallback:
      // in a multi-call session the first `telnyx.call.reattached` event may
      // belong to another call, and settling on it would report recovery for
      // a call that never received a replacement attach.
      const onReattach = (attachedCall: Call) => {
        if (!isCurrent()) {
          log.debug('[TelnyxRTC] Recovery fallback: ignoring stale reattach after cancellation');
          settle(false, { silent: true });
          return;
        }
        if (attachedCall?.callId !== callId) {
          log.debug(
            `[TelnyxRTC] Recovery fallback: ignoring reattach for call ${attachedCall?.callId}, waiting for ${callId}`
          );
          return;
        }
        settle(true);
      };
      const timer = setTimeout(() => {
        log.debug('[TelnyxRTC] Recovery fallback: reattach window expired');
        settle(false, { silent: !isCurrent() });
      }, TelnyxRTC.RECONNECT_TIMEOUT);
      const settle = (value: boolean, options: { silent?: boolean } = {}) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        this.removeListener('telnyx.call.reattached', onReattach);
        this.reconnecting = false;
        this.recoveryReattachActive = false;
        if (!options.silent) {
          recoveringCall?.reportRecoveryReattachOutcome(value);
        }
        if (!value && !options.silent) {
          this.failRecoveryReattach(callId, recoveringCall);
        }
        resolve(value);
      };
      this.addListener('telnyx.call.reattached', onReattach);

      void (async () => {
        log.debug('[TelnyxRTC] Recovery fallback: running one reconnect/register/reattach cycle');
        try {
          if (!isCurrent()) {
            log.debug('[TelnyxRTC] Recovery fallback: cancelled before reconnect teardown');
            settle(false, { silent: true });
            return;
          }
          await this.disconnect(true);
          // Mirror onNetworkUnavailable's peer teardown before the reconnect:
          // the attach creates replacement Call objects keyed by the same call
          // ids, so the old peers (with live microphone tracks) and their
          // per-call state listeners must be disposed first. Disposing the peer
          // also cancels the (now obsolete) per-call recovery coordinators;
          // recovering calls are replaced by the attach itself. Without this,
          // a stale old-call listener could remove the replacement call from
          // tracking when a consumer hangs up via the old Call reference.
          for (const [trackedCallId, call] of Array.from(this.calls.entries())) {
            const stateListener = this.callStateListeners.get(trackedCallId);
            if (stateListener) {
              call.off('telnyx.call.state', stateListener);
              this.callStateListeners.delete(trackedCallId);
            }
            call.disposePeer();
          }
          if (!isCurrent()) {
            log.debug('[TelnyxRTC] Recovery fallback: cancelled before reconnect');
            settle(false, { silent: true });
            return;
          }
          await this.connectSession(true);
          if (!isCurrent()) {
            log.debug('[TelnyxRTC] Recovery fallback: cancelled after reconnect');
            settle(false, { silent: true });
            return;
          }
          log.debug('[TelnyxRTC] Recovery fallback: reconnected, waiting for backend attach');
        } catch (error) {
          if (!isCurrent()) {
            log.debug('[TelnyxRTC] Recovery fallback: cancelled after async error');
            settle(false, { silent: true });
            return;
          }
          log.error('[TelnyxRTC] Recovery fallback: reconnect failed', error);
          settle(false);
        }
      })();
    });
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

        // Update all non-ended calls state to indicate timeout
        // Use Array.from to avoid mutation during iteration
        for (const call of Array.from(this.calls.values())) {
          if (call.state !== 'ended' && call.state !== 'dropped') {
            log.debug(`[TelnyxRTC] Call ${call.callId} failed due to reconnection timeout`);
            call.setDropped();
          }
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
    const targetCall = this.getCall(callId);
    if (targetCall) {
      log.debug('[TelnyxRTC] Setting call to connecting state:', callId);
      targetCall.setConnecting();
    } else {
      log.warn('[TelnyxRTC] Could not find call to set connecting:', callId);
    }
  }

  /**
   * Disables push notifications for the current logged-in user.
   * Push notifications are enabled by default after login.
   * Sends a 'telnyx_rtc.disable_push_notification' message via the socket,
   * matching the Android SDK's disablePushNotification() behavior.
   */
  public disablePushNotification(): void {
    const storedConfig = this.credentialSessionConfig || this.tokenSessionConfig;
    if (!storedConfig) {
      log.warn('[TelnyxRTC] No stored session config, cannot disable push notifications');
      return;
    }

    if (!this.connection) {
      log.warn('[TelnyxRTC] No active connection, cannot disable push notifications');
      return;
    }

    const pushToken = this.options.pushNotificationDeviceToken || '';
    const userAgent = {
      push_device_token: pushToken,
      push_notification_provider: Platform.OS,
    };

    let params: any;
    if ('login_token' in storedConfig && storedConfig.login_token) {
      params = {
        login_token: storedConfig.login_token,
        'User-Agent': userAgent,
      };
    } else {
      params = {
        user: storedConfig.login,
        'User-Agent': userAgent,
      };
    }

    const disablePushMessage = {
      id: uuid(),
      jsonrpc: '2.0',
      method: TelnyxRTCMethod.DISABLE_PUSH_NOTIFICATION,
      params,
    };

    log.debug('[TelnyxRTC] Sending disable push notification message');
    this.connection.send(disablePushMessage);
  }

  private getCallReportConfig(): CallReportConfig {
    return {
      enableCallReports:
        this.options.enableCallReports ?? DEFAULT_CALL_REPORT_CONFIG.enableCallReports,
      callReportInterval:
        this.options.callReportInterval ?? DEFAULT_CALL_REPORT_CONFIG.callReportInterval,
      callReportLogLevel:
        this.options.callReportLogLevel ?? DEFAULT_CALL_REPORT_CONFIG.callReportLogLevel,
      callReportMaxLogEntries:
        this.options.callReportMaxLogEntries ?? DEFAULT_CALL_REPORT_CONFIG.callReportMaxLogEntries,
    };
  }
}
