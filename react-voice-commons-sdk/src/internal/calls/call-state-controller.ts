import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { TelnyxRTC, Call as TelnyxCall, type CallOptions } from '@telnyx/react-native-voice-sdk';
import { Call } from '../../models/call';
import { TelnyxCallState } from '../../models/call-state';
import { SessionManager } from '../session/session-manager';
import { callKitCoordinator } from '../../callkit/callkit-coordinator';

/**
 * Central state machine for call management.
 *
 * This class manages all active calls, handles call state transitions,
 * and provides reactive streams for call-related state changes.
 */
export class CallStateController {
  private readonly _calls = new BehaviorSubject<Call[]>([]);
  private readonly _callMap = new Map<string, Call>();
  private _disposed = false;

  // Callbacks for waiting for invite logic (used for push notifications)
  private _isWaitingForInvite?: () => boolean;
  private _onInviteAutoAccepted?: () => void;

  constructor(private readonly _sessionManager: SessionManager) {
    // Don't set up client listeners here - client doesn't exist yet
    // Will be called when client is available
  }

  /**
   * Observable stream of all current calls
   */
  get calls$(): Observable<Call[]> {
    return this._calls.asObservable().pipe(distinctUntilChanged());
  }

  /**
   * Observable stream of the currently active call
   */
  get activeCall$(): Observable<Call | null> {
    return this.calls$.pipe(
      map((calls) => {
        // Find the first call that is not terminated (includes RINGING, CONNECTING, ACTIVE, HELD)
        return (
          calls.find(
            (call) =>
              call.currentState === TelnyxCallState.RINGING ||
              call.currentState === TelnyxCallState.CONNECTING ||
              call.currentState === TelnyxCallState.ACTIVE ||
              call.currentState === TelnyxCallState.HELD
          ) || null
        );
      }),
      distinctUntilChanged()
    );
  }

  /**
   * Current list of calls (synchronous access)
   */
  get currentCalls(): Call[] {
    return this._calls.value;
  }

  /**
   * Current active call (synchronous access)
   */
  get currentActiveCall(): Call | null {
    const calls = this.currentCalls;
    return (
      calls.find(
        (call) =>
          call.currentState === TelnyxCallState.RINGING ||
          call.currentState === TelnyxCallState.CONNECTING ||
          call.currentState === TelnyxCallState.ACTIVE ||
          call.currentState === TelnyxCallState.HELD
      ) || null
    );
  }

  /**
   * Set a call to connecting state (used for push notification calls when answered via CallKit)
   * @param callId The ID of the call to set to connecting state
   */
  setCallConnecting(callId: string): void {
    const call = this._callMap.get(callId);
    if (call) {
      console.log('CallStateController: Setting call to connecting state:', callId);
      call.setConnecting();
    } else {
      console.warn('CallStateController: Could not find call to set connecting:', callId);
    }
  }

  /**
   * Find a call by its underlying Telnyx call ID
   * @param telnyxCall The Telnyx call object to find
   */
  findCallByTelnyxCall(telnyxCall: any): Call | null {
    for (const call of this._callMap.values()) {
      if (call.telnyxCall === telnyxCall || call.telnyxCall.callId === telnyxCall.callId) {
        return call;
      }
    }
    return null;
  }

  /**
   * Initialize client listeners when the Telnyx client becomes available
   * This should be called by the session manager after client creation
   */
  initializeClientListeners(): void {
    console.log('🔧 CallStateController: initializeClientListeners called');
    this._setupClientListeners();

    // CallKit integration now handled by CallKitCoordinator
    console.log('🔧 CallStateController: Using CallKitCoordinator for CallKit integration');
  }

  /**
   * Initiate a new outgoing call
   */
  async newCall(
    destination: string,
    callerName?: string,
    callerNumber?: string,
    debug: boolean = false
  ): Promise<Call> {
    if (this._disposed) {
      throw new Error('CallStateController has been disposed');
    }

    if (!this._sessionManager.telnyxClient) {
      throw new Error('Telnyx client not available');
    }

    try {
      // Create the call using the Telnyx SDK
      const callOptions: CallOptions = {
        destinationNumber: destination,
        callerIdName: callerName,
        callerIdNumber: callerNumber,
      };
      const telnyxCall = await this._sessionManager.telnyxClient.newCall(callOptions);

      // Create our wrapper Call object
      const call = new Call(
        telnyxCall,
        telnyxCall.callId || this._generateCallId(),
        destination,
        false // outgoing call
      );

      // Add to our call tracking
      this._addCall(call);

      return call;
    } catch (error) {
      console.error('Failed to create new call:', error);
      throw error;
    }
  }

  /**
   * Set callbacks for waiting for invite logic (used for push notifications)
   */
  setWaitingForInviteCallbacks(callbacks: {
    isWaitingForInvite: () => boolean;
    onInviteAutoAccepted: () => void;
  }): void {
    this._isWaitingForInvite = callbacks.isWaitingForInvite;
    this._onInviteAutoAccepted = callbacks.onInviteAutoAccepted;
  }

  /**
   * Dispose of the controller and clean up resources
   */
  dispose(): void {
    if (this._disposed) {
      return;
    }

    this._disposed = true;

    // Dispose of all calls
    this.currentCalls.forEach((call) => call.dispose());
    this._callMap.clear();

    // CallKit cleanup is now handled by CallKitCoordinator automatically

    this._calls.complete();
  }

  /**
   * Set up event listeners for the Telnyx client
   */
  private _setupClientListeners(): void {
    console.log('🔧 CallStateController: Setting up client listeners...');

    if (!this._sessionManager.telnyxClient) {
      console.log('🔧 CallStateController: No telnyxClient available yet, skipping listener setup');
      return;
    }

    console.log('🔧 CallStateController: TelnyxClient found, setting up incoming call listener');

    // Listen for incoming calls
    this._sessionManager.telnyxClient.on(
      'telnyx.call.incoming',
      (telnyxCall: TelnyxCall, msg: any) => {
        console.log('📞 CallStateController: Incoming call received:', telnyxCall.callId);
        this._handleIncomingCall(telnyxCall, msg);
      }
    );

    // Listen for other call events if needed
    // this._sessionManager.telnyxClient.on('telnyx.call.stateChange', this._handleCallStateChange.bind(this));

    console.log('🔧 CallStateController: Client listeners set up successfully');
  }

  /**
   * Handle incoming call
   */
  private _handleIncomingCall(telnyxCall: TelnyxCall, inviteMsg?: any): void {
    const callId = telnyxCall.callId || this._generateCallId();

    console.log('📞 CallStateController: Handling incoming call:', callId);
    console.log('📞 CallStateController: TelnyxCall object:', telnyxCall);
    console.log('📞 CallStateController: Invite message:', inviteMsg);

    // Check if we already have this call
    if (this._callMap.has(callId)) {
      console.log('Call already exists:', callId);
      return;
    }

    // Get caller information from the invite message (preferred) or fallback to TelnyxCall
    let callerNumber = 'Unknown';
    let callerName = 'Unknown';

    if (inviteMsg && inviteMsg.params) {
      callerNumber = inviteMsg.params.caller_id_number || 'Unknown';
      callerName = inviteMsg.params.caller_id_name || callerNumber;
      console.log(
        '📞 CallStateController: Extracted caller info from invite - Number:',
        callerNumber,
        'Name:',
        callerName
      );
    } else {
      // Fallback to TelnyxCall properties
      callerNumber = telnyxCall.remoteCallerIdNumber || 'Unknown';
      callerName = telnyxCall.remoteCallerIdName || callerNumber;
      console.log(
        '📞 CallStateController: Extracted caller info from TelnyxCall - Number:',
        callerNumber,
        'Name:',
        callerName
      );
    }

    // Create our wrapper Call object
    const call = new Call(
      telnyxCall,
      callId,
      callerNumber, // Use caller number as destination for incoming calls
      true // incoming call
    );

    // Check if we're waiting for an invite (push notification scenario)
    if (this._isWaitingForInvite && this._isWaitingForInvite()) {
      console.log('Auto-accepting call from push notification');
      call.answer().catch((error) => {
        console.error('Failed to auto-accept call:', error);
      });

      if (this._onInviteAutoAccepted) {
        this._onInviteAutoAccepted();
      }
    }

    // Add to our call tracking - CallKit integration happens in _addCall
    this._addCall(call);
  }

  /**
   * Handle call state changes from the Telnyx client
   */
  private _handleCallStateChange(event: any): void {
    const callId = event.callId || event.id;
    const call = this._callMap.get(callId);

    if (call) {
      // The Call object will handle its own state updates through its listeners
      console.log(`Call ${callId} state changed to ${event.state}`);
    } else {
      console.warn(`Received state change for unknown call: ${callId}`);
    }
  }

  /**
   * Handle call updates from notifications
   */
  private _handleCallUpdate(callData: any): void {
    const callId = callData.id;
    const call = this._callMap.get(callId);

    if (call) {
      // Update call state based on the notification
      console.log(`Call ${callId} updated:`, callData);
    } else {
      console.warn(`Received update for unknown call: ${callId}`);
    }
  }

  /**
   * Add a call to our tracking
   */
  private _addCall(call: Call): void {
    this._callMap.set(call.callId, call);

    const currentCalls = this.currentCalls;
    currentCalls.push(call);
    this._calls.next([...currentCalls]);

    // Integrate with CallKit using CallKitCoordinator
    if (callKitCoordinator.isAvailable()) {
      // Get the underlying TelnyxCall for CallKitCoordinator
      const telnyxCall = call.telnyxCall;

      // Check if this call already has CallKit integration (e.g., from push notification)
      const existingCallKitUUID = callKitCoordinator.getCallKitUUID(telnyxCall);

      if (existingCallKitUUID) {
        console.log(
          'CallStateController: Call already has CallKit integration, skipping duplicate report:',
          existingCallKitUUID
        );
      } else if (call.isIncoming) {
        // Handle incoming call with CallKit (only if not already integrated)
        console.log('CallStateController: Reporting incoming call to CallKitCoordinator');
        callKitCoordinator.reportIncomingCall(telnyxCall, call.destination, call.destination);
      } else {
        // Handle outgoing call with CallKit
        console.log('CallStateController: Starting outgoing call with CallKitCoordinator');
        callKitCoordinator.startOutgoingCall(telnyxCall, call.destination, call.destination);
      }
    }

    // Listen for call state changes - CallKitCoordinator handles this automatically
    call.callState$.subscribe((state) => {
      // CallKitCoordinator automatically updates CallKit via setupWebRTCCallListeners
      console.log('CallStateController: Call state changed to:', state);

      // Clean up when call ends
      if (state === TelnyxCallState.ENDED || state === TelnyxCallState.FAILED) {
        this._removeCall(call.callId);
      }
    });
  }

  /**
   * Remove a call from our tracking
   */
  private _removeCall(callId: string): void {
    const call = this._callMap.get(callId);
    if (call) {
      // CallKit cleanup is handled automatically by CallKitCoordinator

      call.dispose();
      this._callMap.delete(callId);

      const currentCalls = this.currentCalls.filter((c) => c.callId !== callId);
      this._calls.next(currentCalls);
    }
  }

  /**
   * Generate a unique call ID
   */
  private _generateCallId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
