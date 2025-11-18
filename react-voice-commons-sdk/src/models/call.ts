import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { TelnyxCallState, CallStateHelpers } from './call-state';
import { Call as TelnyxCall } from '@telnyx/react-native-voice-sdk';
import { Platform } from 'react-native';

/**
 * Represents a call with reactive state streams.
 *
 * This class wraps the underlying Telnyx Call object and provides
 * reactive streams for all call state changes, making it easy to
 * integrate with any state management solution.
 */
export class Call {
  private readonly _callState = new BehaviorSubject<TelnyxCallState>(TelnyxCallState.RINGING);
  private readonly _isMuted = new BehaviorSubject<boolean>(false);
  private readonly _isHeld = new BehaviorSubject<boolean>(false);
  private readonly _duration = new BehaviorSubject<number>(0);

  private _durationTimer?: NodeJS.Timeout;
  private _startTime?: Date;

  constructor(
    private readonly _telnyxCall: TelnyxCall,
    private readonly _callId: string,
    private readonly _destination: string,
    private readonly _isIncoming: boolean,
    isReattached: boolean = false,
    private readonly _originalCallerName?: string,
    private readonly _originalCallerNumber?: string
  ) {
    // Set initial state based on whether this is a reattached call
    if (isReattached) {
      console.log('Call: Setting initial state to ACTIVE for reattached call');
      this._callState.next(TelnyxCallState.ACTIVE);
    }

    this._setupCallListeners();
  }

  /**
   * Unique identifier for this call
   */
  get callId(): string {
    return this._callId;
  }

  /**
   * The destination number or SIP URI
   */
  get destination(): string {
    return this._destination;
  }

  /**
   * Whether this is an incoming call
   */
  get isIncoming(): boolean {
    return this._isIncoming;
  }

  /**
   * Whether this is an outgoing call
   */
  get isOutgoing(): boolean {
    return !this._isIncoming;
  }

  /**
   * Current call state (synchronous access)
   */
  get currentState(): TelnyxCallState {
    return this._callState.value;
  }

  /**
   * Current mute state (synchronous access)
   */
  get currentIsMuted(): boolean {
    return this._isMuted.value;
  }

  /**
   * Current hold state (synchronous access)
   */
  get currentIsHeld(): boolean {
    return this._isHeld.value;
  }

  /**
   * Current call duration in seconds (synchronous access)
   */
  get currentDuration(): number {
    return this._duration.value;
  }

  /**
   * Custom headers received from the WebRTC INVITE message.
   * These headers are passed during call initiation and can contain application-specific information.
   * Format should be [{"name": "X-Header-Name", "value": "Value"}] where header names must start with "X-".
   */
  get inviteCustomHeaders(): { name: string; value: string }[] | null {
    return this._telnyxCall.inviteCustomHeaders;
  }

  /**
   * Custom headers received from the WebRTC ANSWER message.
   * These headers are passed during call acceptance and can contain application-specific information.
   * Format should be [{"name": "X-Header-Name", "value": "Value"}] where header names must start with "X-".
   */
  get answerCustomHeaders(): { name: string; value: string }[] | null {
    return this._telnyxCall.answerCustomHeaders;
  }

  /**
   * Get the underlying Telnyx Call object (for internal use)
   * @internal
   */
  get telnyxCall(): TelnyxCall {
    return this._telnyxCall;
  }

  /**
   * Observable stream of call state changes
   */
  get callState$(): Observable<TelnyxCallState> {
    return this._callState.asObservable().pipe(distinctUntilChanged());
  }

  /**
   * Observable stream of mute state changes
   */
  get isMuted$(): Observable<boolean> {
    return this._isMuted.asObservable().pipe(distinctUntilChanged());
  }

  /**
   * Observable stream of hold state changes
   */
  get isHeld$(): Observable<boolean> {
    return this._isHeld.asObservable().pipe(distinctUntilChanged());
  }

  /**
   * Observable stream of call duration changes (in seconds)
   */
  get duration$(): Observable<number> {
    return this._duration.asObservable().pipe(distinctUntilChanged());
  }

  /**
   * Observable that emits true when the call can be answered
   */
  get canAnswer$(): Observable<boolean> {
    return this.callState$.pipe(
      map((state) => CallStateHelpers.canAnswer(state)),
      distinctUntilChanged()
    );
  }

  /**
   * Observable that emits true when the call can be hung up
   */
  get canHangup$(): Observable<boolean> {
    return this.callState$.pipe(
      map((state) => CallStateHelpers.canHangup(state)),
      distinctUntilChanged()
    );
  }

  /**
   * Observable that emits true when the call can be put on hold
   */
  get canHold$(): Observable<boolean> {
    return this.callState$.pipe(
      map((state) => CallStateHelpers.canHold(state)),
      distinctUntilChanged()
    );
  }

  /**
   * Observable that emits true when the call can be resumed from hold
   */
  get canResume$(): Observable<boolean> {
    return this.callState$.pipe(
      map((state) => CallStateHelpers.canResume(state)),
      distinctUntilChanged()
    );
  }

  /**
   * Answer the incoming call
   * @param customHeaders Optional custom headers to include with the answer
   */
  async answer(customHeaders?: { name: string; value: string }[]): Promise<void> {
    if (!CallStateHelpers.canAnswer(this.currentState)) {
      throw new Error(`Cannot answer call in state: ${this.currentState}`);
    }

    try {
      // On iOS, use CallKit coordinator for proper audio session handling
      if (Platform.OS === 'ios') {
        const { callKitCoordinator } = await import('../callkit/callkit-coordinator');
        if (callKitCoordinator.isAvailable()) {
          console.log('Call: Using CallKit coordinator to answer call (iOS)');
          await callKitCoordinator.answerCallFromUI(this._telnyxCall);
          return;
        }
      }

      // Fallback for Android or when CallKit is not available
      console.log('Call: Setting state to CONNECTING before answering');
      this._callState.next(TelnyxCallState.CONNECTING);

      // Pass custom headers to the underlying Telnyx call
      await this._telnyxCall.answer(customHeaders);
    } catch (error) {
      console.error('Failed to answer call:', error);
      throw error;
    }
  }

  /**
   * Hang up the call
   * @param customHeaders Optional custom headers to include with the hangup request
   */
  async hangup(customHeaders?: { name: string; value: string }[]): Promise<void> {
    if (!CallStateHelpers.canHangup(this.currentState)) {
      throw new Error(`Cannot hang up call in state: ${this.currentState}`);
    }

    try {
      // On iOS, use CallKit coordinator for proper CallKit cleanup
      if (Platform.OS === 'ios') {
        const { callKitCoordinator } = await import('../callkit/callkit-coordinator');
        if (callKitCoordinator.isAvailable()) {
          console.log('Call: Using CallKit coordinator to end call (iOS)');
          await callKitCoordinator.endCallFromUI(this._telnyxCall);
          return;
        }
      }

      // Fallback for Android or when CallKit is not available
      await this._telnyxCall.hangup(customHeaders);

      // On Android, also notify the native side to hide ongoing notification
      if (Platform.OS === 'android') {
        try {
          const { VoicePnBridge } = await import('../internal/voice-pn-bridge');
          await VoicePnBridge.endCall(this._callId);
          console.log('Call: Notified Android to hide ongoing notification');
        } catch (error) {
          console.error('Call: Failed to notify Android about call end:', error);
          // Don't fail the hangup if notification hiding fails
        }
      }
    } catch (error) {
      console.error('Failed to hang up call:', error);
      throw error;
    }
  }

  /**
   * Put the call on hold
   */
  async hold(): Promise<void> {
    if (!CallStateHelpers.canHold(this.currentState)) {
      throw new Error(`Cannot hold call in state: ${this.currentState}`);
    }

    try {
      await this._telnyxCall.hold();
    } catch (error) {
      console.error('Failed to hold call:', error);
      throw error;
    }
  }

  /**
   * Resume the call from hold
   */
  async resume(): Promise<void> {
    if (!CallStateHelpers.canResume(this.currentState)) {
      throw new Error(`Cannot resume call in state: ${this.currentState}`);
    }

    try {
      await this._telnyxCall.unhold();
    } catch (error) {
      console.error('Failed to resume call:', error);
      throw error;
    }
  }

  /**
   * Mute the call
   */
  async mute(): Promise<void> {
    if (!CallStateHelpers.canToggleMute(this.currentState)) {
      throw new Error(`Cannot mute call in state: ${this.currentState}`);
    }

    try {
      this._telnyxCall.mute();
      this._isMuted.next(true);
    } catch (error) {
      console.error('Failed to mute call:', error);
      throw error;
    }
  }

  /**
   * Unmute the call
   */
  async unmute(): Promise<void> {
    if (!CallStateHelpers.canToggleMute(this.currentState)) {
      throw new Error(`Cannot unmute call in state: ${this.currentState}`);
    }

    try {
      this._telnyxCall.unmute();
      this._isMuted.next(false);
    } catch (error) {
      console.error('Failed to unmute call:', error);
      throw error;
    }
  }

  /**
   * Toggle mute state
   */
  async toggleMute(): Promise<void> {
    if (this.currentIsMuted) {
      await this.unmute();
    } else {
      await this.mute();
    }
  }

  /**
   * Set the call to connecting state (used for push notification calls when answered via CallKit)
   * @internal
   */
  setConnecting(): void {
    console.log('Call: Setting state to CONNECTING for push notification answer');
    this._callState.next(TelnyxCallState.CONNECTING);
  }

  /**
   * Clean up resources when the call is disposed
   */
  dispose(): void {
    this._stopDurationTimer();
    this._callState.complete();
    this._isMuted.complete();
    this._isHeld.complete();
    this._duration.complete();
  }

  /**
   * Set up listeners for the underlying Telnyx call
   */
  private _setupCallListeners(): void {
    // Map Telnyx call states to our simplified states
    this._telnyxCall.on('telnyx.call.state', (call: any, state: any) => {
      const telnyxState = this._mapToTelnyxCallState(state);
      this._callState.next(telnyxState);

      // Start duration timer when call becomes active
      if (telnyxState === TelnyxCallState.ACTIVE && !this._startTime) {
        this._startDurationTimer();

        // Show ongoing call notification on Android when call becomes active
        // This covers both locally answered calls and calls that become active from remote side
        if (Platform.OS === 'android') {
          (async () => {
            try {
              const { VoicePnBridge } = await import('../internal/voice-pn-bridge');

              // Extract caller information based on call direction
              let callerNumber: string | undefined;
              let callerName: string | undefined;

              if (this._isIncoming) {
                // For incoming calls, use the remote caller ID (who's calling us)
                callerNumber = this._telnyxCall.remoteCallerIdNumber;
                callerName = this._telnyxCall.remoteCallerIdName;
              } else {
                // For outgoing calls, use our own caller ID (what we're showing to them)
                // These are the values we set when making the call
                callerNumber = this._telnyxCall.localCallerIdNumber || this._originalCallerNumber;
                callerName = this._telnyxCall.localCallerIdName || this._originalCallerName;
              }

              // Fallback logic for better notification display - avoid "Unknown" when possible
              let displayName: string;
              let displayNumber: string;

              if (this._isIncoming) {
                // For incoming calls: use caller name or fall back to caller number, then destination
                displayName = callerName || callerNumber || this._destination;
                displayNumber = callerNumber || this._destination;
              } else {
                // For outgoing calls: use our caller ID or descriptive text
                displayName = callerName || `${this._destination}`;
                displayNumber = callerNumber || this._destination;
              }

              await VoicePnBridge.showOngoingCallNotification(
                displayName,
                displayNumber,
                this._callId
              );
              console.log('Call: Showed ongoing call notification on Android (call active)', {
                isIncoming: this._isIncoming,
                callerName: displayName,
                callerNumber: displayNumber,
              });
            } catch (error) {
              console.error('Call: Failed to show ongoing call notification on active:', error);
            }
          })();
        }
      }

      // Stop duration timer when call ends
      if (CallStateHelpers.isTerminated(telnyxState)) {
        this._stopDurationTimer();

        // Clean up ongoing call notification on Android when call ends
        if (Platform.OS === 'android') {
          (async () => {
            try {
              const { VoicePnBridge } = await import('../internal/voice-pn-bridge');
              await VoicePnBridge.endCall(this._callId);
              console.log('Call: Cleaned up ongoing call notification (call terminated)');
            } catch (error) {
              console.error(
                'Call: Failed to clean up ongoing call notification on termination:',
                error
              );
            }
          })();
        }
      }
    });
  }

  /**
   * Map Telnyx SDK call states to our simplified call states
   */
  private _mapToTelnyxCallState(telnyxState: any): TelnyxCallState {
    // This mapping will depend on the actual Telnyx SDK call states
    // For now, using a basic mapping - this should be updated based on actual SDK
    switch (telnyxState) {
      case 'ringing':
      case 'new':
        return TelnyxCallState.RINGING;
      case 'connecting':
        return TelnyxCallState.CONNECTING;
      case 'active':
      case 'answered':
        return TelnyxCallState.ACTIVE;
      case 'held':
        return TelnyxCallState.HELD;
      case 'ended':
      case 'hangup':
        return TelnyxCallState.ENDED;
      case 'failed':
      case 'rejected':
        return TelnyxCallState.FAILED;
      case 'dropped':
        return TelnyxCallState.DROPPED;
      default:
        console.warn(`Unknown call state: ${telnyxState}`);
        return TelnyxCallState.RINGING;
    }
  }

  /**
   * Start the duration timer
   */
  private _startDurationTimer(): void {
    this._startTime = new Date();
    this._durationTimer = setInterval(() => {
      if (this._startTime) {
        const duration = Math.floor((Date.now() - this._startTime.getTime()) / 1000);
        this._duration.next(duration);
      }
    }, 1000);
  }

  /**
   * Stop the duration timer
   */
  private _stopDurationTimer(): void {
    if (this._durationTimer) {
      clearInterval(this._durationTimer);
      this._durationTimer = undefined;
    }
  }
}
