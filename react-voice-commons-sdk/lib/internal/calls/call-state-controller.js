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
    console.log('CallStateController: Constructor called - instance created');
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
   * Access any active call tracked by the client.
   * A call will be accessible until it has ended (transitioned to the ENDED state).
   * This matches the TelnyxRTC `getCall(callId)` method for multi-call support.
   *
   * @param callId The unique identifier of a call.
   * @returns The Call object that matches the requested callId, or null if not found.
   */
  getCall(callId) {
    return this._callMap.get(callId) || null;
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
    console.log('CallStateController: initializeClientListeners called');
    console.log('CallStateController: Current client exists:', !!this._sessionManager.telnyxClient);
    this._setupClientListeners();
    // CallKit integration now handled by CallKitCoordinator
    console.log('CallStateController: Using CallKitCoordinator for CallKit integration');
  }
  /**
   * Initiate a new outgoing call
   */
  async newCall(destination, callerName, callerNumber, customHeaders) {
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
        customHeaders,
      };
      const telnyxCall = await this._sessionManager.telnyxClient.newCall(callOptions);
      // Create our wrapper Call object
      const call = new call_1.Call(
        telnyxCall,
        telnyxCall.callId || this._generateCallId(),
        destination,
        false, // outgoing call
        false, // not reattached
        callerName || destination, // use destination as fallback for caller name
        callerNumber // original caller number
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
    console.log('CallStateController: Setting up client listeners...');
    if (!this._sessionManager.telnyxClient) {
      console.log('CallStateController: No telnyxClient available yet, skipping listener setup');
      return;
    }
    console.log('CallStateController: TelnyxClient found, setting up incoming call listener');
    console.log(
      'CallStateController: Client instance:',
      this._sessionManager.telnyxClient.constructor.name
    );
    // Listen for incoming calls
    this._sessionManager.telnyxClient.on('telnyx.call.incoming', (telnyxCall, msg) => {
      console.log('CallStateController: Incoming call received:', telnyxCall.callId);
      this._handleIncomingCall(telnyxCall, msg, false);
    });
    // Listen for reattached calls (after network reconnection)
    this._sessionManager.telnyxClient.on('telnyx.call.reattached', (telnyxCall, msg) => {
      console.log('CallStateController: Reattached call received:', telnyxCall.callId);
      this._handleIncomingCall(telnyxCall, msg, true);
    });
    // Verify listeners are set up
    const incomingListeners =
      this._sessionManager.telnyxClient.listenerCount('telnyx.call.incoming');
    const reattachedListeners =
      this._sessionManager.telnyxClient.listenerCount('telnyx.call.reattached');
    console.log(
      'CallStateController: Listeners registered - incoming:',
      incomingListeners,
      'reattached:',
      reattachedListeners
    );
    // Listen for call state changes from the TelnyxRTC client (multi-call support)
    this._sessionManager.telnyxClient.on('telnyx.call.stateChanged', (telnyxCall, state) => {
      console.log(
        'CallStateController: Call state changed from TelnyxRTC:',
        telnyxCall.callId,
        state
      );
      // Find our wrapper call and update if needed
      const call = this.findCallByTelnyxCall(telnyxCall);
      if (call) {
        console.log(
          'CallStateController: Found wrapper call, state sync handled by Call subscription'
        );
      }
    });
    // Listen for call removal events from TelnyxRTC (multi-call support)
    this._sessionManager.telnyxClient.on('telnyx.call.removed', (callId) => {
      console.log('CallStateController: Call removed from TelnyxRTC:', callId);
      // The call cleanup is already handled by our call state subscription
      // This event is informational for logging/debugging
    });
    console.log('CallStateController: Client listeners set up successfully');
  }
  /**
   * Handle incoming call or reattached call
   */
  _handleIncomingCall(telnyxCall, inviteMsg, isReattached = false) {
    const callId = telnyxCall.callId || this._generateCallId();
    console.log(
      'CallStateController: Handling incoming call:',
      callId,
      'isReattached:',
      isReattached
    );
    console.log('CallStateController: TelnyxCall object:', telnyxCall);
    console.log('CallStateController: Invite message:', inviteMsg);
    // For reattached calls, remove existing call and create new one
    if (isReattached && this._callMap.has(callId)) {
      console.log('CallStateController: Removing existing call for reattachment');
      const existingCall = this._callMap.get(callId);
      if (existingCall) {
        console.log(
          'CallStateController: Existing call state before removal:',
          existingCall.currentState
        );
        this._removeCall(callId);
      }
    }
    // Check if we already have this call (for non-reattached calls)
    if (this._callMap.has(callId) && !isReattached) {
      console.log('Call already exists:', callId);
      return;
    }
    // Get caller information from the invite message (preferred) or fallback to TelnyxCall
    let callerNumber = '';
    let callerName = '';
    if (inviteMsg && inviteMsg.params) {
      callerNumber = inviteMsg.params.caller_id_number || '';
      callerName = inviteMsg.params.caller_id_name || '';
      console.log(
        'CallStateController: Extracted caller info from invite - Number:',
        callerNumber,
        'Name:',
        callerName
      );
    } else {
      // Fallback to TelnyxCall properties
      callerNumber = telnyxCall.remoteCallerIdNumber || '';
      callerName = telnyxCall.remoteCallerIdName || '';
      console.log(
        'CallStateController: Extracted caller info from TelnyxCall - Number:',
        callerNumber,
        'Name:',
        callerName
      );
    }
    // Use smart fallbacks - prefer caller number over "Unknown"
    const finalCallerNumber = callerNumber || 'Unknown Number';
    const finalCallerName = callerName || callerNumber || 'Unknown Caller';
    // Create our wrapper Call object
    const call = new call_1.Call(
      telnyxCall,
      callId,
      finalCallerNumber, // Use caller number as destination for incoming calls
      true, // incoming call
      isReattached, // pass the reattached flag
      finalCallerName, // use caller name or fallback to number
      finalCallerNumber // use caller number
    );
    // Add to our call tracking - CallKit integration happens in _addCall
    this._addCall(call);
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
      console.log('CallStateController: Removing call:', callId);
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
