'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.CallStateController = void 0;
const rxjs_1 = require('rxjs');
const operators_1 = require('rxjs/operators');
const call_1 = require('../../models/call');
const call_state_1 = require('../../models/call-state');
const callkit_coordinator_1 = require('../../callkit/callkit-coordinator');
/**
 * Central state machine for call management.
 *
 * This class manages all active calls, handles call state transitions,
 * and provides reactive streams for call-related state changes.
 */
class CallStateController {
  constructor(_sessionManager) {
    this._sessionManager = _sessionManager;
    this._calls = new rxjs_1.BehaviorSubject([]);
    this._callMap = new Map();
    this._disposed = false;
    // Don't set up client listeners here - client doesn't exist yet
    // Will be called when client is available
  }
  /**
   * Observable stream of all current calls
   */
  get calls$() {
    return this._calls.asObservable().pipe((0, operators_1.distinctUntilChanged)());
  }
  /**
   * Observable stream of the currently active call
   */
  get activeCall$() {
    return this.calls$.pipe(
      (0, operators_1.map)((calls) => {
        // Find the first call that is not terminated (includes RINGING, CONNECTING, ACTIVE, HELD)
        return (
          calls.find(
            (call) =>
              call.currentState === call_state_1.TelnyxCallState.RINGING ||
              call.currentState === call_state_1.TelnyxCallState.CONNECTING ||
              call.currentState === call_state_1.TelnyxCallState.ACTIVE ||
              call.currentState === call_state_1.TelnyxCallState.HELD
          ) || null
        );
      }),
      (0, operators_1.distinctUntilChanged)()
    );
  }
  /**
   * Current list of calls (synchronous access)
   */
  get currentCalls() {
    return this._calls.value;
  }
  /**
   * Current active call (synchronous access)
   */
  get currentActiveCall() {
    const calls = this.currentCalls;
    return (
      calls.find(
        (call) =>
          call.currentState === call_state_1.TelnyxCallState.RINGING ||
          call.currentState === call_state_1.TelnyxCallState.CONNECTING ||
          call.currentState === call_state_1.TelnyxCallState.ACTIVE ||
          call.currentState === call_state_1.TelnyxCallState.HELD
      ) || null
    );
  }
  /**
   * Set a call to connecting state (used for push notification calls when answered via CallKit)
   * @param callId The ID of the call to set to connecting state
   */
  setCallConnecting(callId) {
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
  findCallByTelnyxCall(telnyxCall) {
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
  initializeClientListeners() {
    console.log('🔧 CallStateController: initializeClientListeners called');
    this._setupClientListeners();
    // CallKit integration now handled by CallKitCoordinator
    console.log('🔧 CallStateController: Using CallKitCoordinator for CallKit integration');
  }
  /**
   * Initiate a new outgoing call
   */
  async newCall(destination, callerName, callerNumber, debug = false) {
    if (this._disposed) {
      throw new Error('CallStateController has been disposed');
    }
    if (!this._sessionManager.telnyxClient) {
      throw new Error('Telnyx client not available');
    }
    try {
      // Create the call using the Telnyx SDK
      const callOptions = {
        destinationNumber: destination,
        callerIdName: callerName,
        callerIdNumber: callerNumber,
      };
      const telnyxCall = await this._sessionManager.telnyxClient.newCall(callOptions);
      // Create our wrapper Call object
      const call = new call_1.Call(
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
  setWaitingForInviteCallbacks(callbacks) {
    this._isWaitingForInvite = callbacks.isWaitingForInvite;
    this._onInviteAutoAccepted = callbacks.onInviteAutoAccepted;
  }
  /**
   * Dispose of the controller and clean up resources
   */
  dispose() {
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
  _setupClientListeners() {
    console.log('🔧 CallStateController: Setting up client listeners...');
    if (!this._sessionManager.telnyxClient) {
      console.log('🔧 CallStateController: No telnyxClient available yet, skipping listener setup');
      return;
    }
    console.log('🔧 CallStateController: TelnyxClient found, setting up incoming call listener');
    // Listen for incoming calls
    this._sessionManager.telnyxClient.on('telnyx.call.incoming', (telnyxCall, msg) => {
      console.log('📞 CallStateController: Incoming call received:', telnyxCall.callId);
      this._handleIncomingCall(telnyxCall, msg);
    });
    // Listen for other call events if needed
    // this._sessionManager.telnyxClient.on('telnyx.call.stateChange', this._handleCallStateChange.bind(this));
    console.log('🔧 CallStateController: Client listeners set up successfully');
  }
  /**
   * Handle incoming call
   */
  _handleIncomingCall(telnyxCall, inviteMsg) {
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
    const call = new call_1.Call(
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
  _handleCallStateChange(event) {
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
  _handleCallUpdate(callData) {
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
  _addCall(call) {
    this._callMap.set(call.callId, call);
    const currentCalls = this.currentCalls;
    currentCalls.push(call);
    this._calls.next([...currentCalls]);
    // Integrate with CallKit using CallKitCoordinator
    if (callkit_coordinator_1.callKitCoordinator.isAvailable()) {
      // Get the underlying TelnyxCall for CallKitCoordinator
      const telnyxCall = call.telnyxCall;
      // Check if this call already has CallKit integration (e.g., from push notification)
      const existingCallKitUUID =
        callkit_coordinator_1.callKitCoordinator.getCallKitUUID(telnyxCall);
      if (existingCallKitUUID) {
        console.log(
          'CallStateController: Call already has CallKit integration, skipping duplicate report:',
          existingCallKitUUID
        );
      } else if (call.isIncoming) {
        // Handle incoming call with CallKit (only if not already integrated)
        console.log('CallStateController: Reporting incoming call to CallKitCoordinator');
        callkit_coordinator_1.callKitCoordinator.reportIncomingCall(
          telnyxCall,
          call.destination,
          call.destination
        );
      } else {
        // Handle outgoing call with CallKit
        console.log('CallStateController: Starting outgoing call with CallKitCoordinator');
        callkit_coordinator_1.callKitCoordinator.startOutgoingCall(
          telnyxCall,
          call.destination,
          call.destination
        );
      }
    }
    // Listen for call state changes - CallKitCoordinator handles this automatically
    call.callState$.subscribe((state) => {
      // CallKitCoordinator automatically updates CallKit via setupWebRTCCallListeners
      console.log('CallStateController: Call state changed to:', state);
      // Clean up when call ends
      if (
        state === call_state_1.TelnyxCallState.ENDED ||
        state === call_state_1.TelnyxCallState.FAILED
      ) {
        this._removeCall(call.callId);
      }
    });
  }
  /**
   * Remove a call from our tracking
   */
  _removeCall(callId) {
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
  _generateCallId() {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
exports.CallStateController = CallStateController;
