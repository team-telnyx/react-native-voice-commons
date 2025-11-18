"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Call = void 0;
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const call_state_1 = require("./call-state");
const react_native_1 = require("react-native");
/**
 * Represents a call with reactive state streams.
 *
 * This class wraps the underlying Telnyx Call object and provides
 * reactive streams for all call state changes, making it easy to
 * integrate with any state management solution.
 */
class Call {
    constructor(_telnyxCall, _callId, _destination, _isIncoming, isReattached = false, _originalCallerName, _originalCallerNumber) {
        this._telnyxCall = _telnyxCall;
        this._callId = _callId;
        this._destination = _destination;
        this._isIncoming = _isIncoming;
        this._originalCallerName = _originalCallerName;
        this._originalCallerNumber = _originalCallerNumber;
        this._callState = new rxjs_1.BehaviorSubject(call_state_1.TelnyxCallState.RINGING);
        this._isMuted = new rxjs_1.BehaviorSubject(false);
        this._isHeld = new rxjs_1.BehaviorSubject(false);
        this._duration = new rxjs_1.BehaviorSubject(0);
        // Set initial state based on whether this is a reattached call
        if (isReattached) {
            console.log('Call: Setting initial state to ACTIVE for reattached call');
            this._callState.next(call_state_1.TelnyxCallState.ACTIVE);
        }
        this._setupCallListeners();
    }
    /**
     * Unique identifier for this call
     */
    get callId() {
        return this._callId;
    }
    /**
     * The destination number or SIP URI
     */
    get destination() {
        return this._destination;
    }
    /**
     * Whether this is an incoming call
     */
    get isIncoming() {
        return this._isIncoming;
    }
    /**
     * Whether this is an outgoing call
     */
    get isOutgoing() {
        return !this._isIncoming;
    }
    /**
     * Current call state (synchronous access)
     */
    get currentState() {
        return this._callState.value;
    }
    /**
     * Current mute state (synchronous access)
     */
    get currentIsMuted() {
        return this._isMuted.value;
    }
    /**
     * Current hold state (synchronous access)
     */
    get currentIsHeld() {
        return this._isHeld.value;
    }
    /**
     * Current call duration in seconds (synchronous access)
     */
    get currentDuration() {
        return this._duration.value;
    }
    /**
     * Custom headers received from the WebRTC INVITE message.
     * These headers are passed during call initiation and can contain application-specific information.
     * Format should be [{"name": "X-Header-Name", "value": "Value"}] where header names must start with "X-".
     */
    get inviteCustomHeaders() {
        return this._telnyxCall.inviteCustomHeaders;
    }
    /**
     * Custom headers received from the WebRTC ANSWER message.
     * These headers are passed during call acceptance and can contain application-specific information.
     * Format should be [{"name": "X-Header-Name", "value": "Value"}] where header names must start with "X-".
     */
    get answerCustomHeaders() {
        return this._telnyxCall.answerCustomHeaders;
    }
    /**
     * Get the underlying Telnyx Call object (for internal use)
     * @internal
     */
    get telnyxCall() {
        return this._telnyxCall;
    }
    /**
     * Observable stream of call state changes
     */
    get callState$() {
        return this._callState.asObservable().pipe((0, operators_1.distinctUntilChanged)());
    }
    /**
     * Observable stream of mute state changes
     */
    get isMuted$() {
        return this._isMuted.asObservable().pipe((0, operators_1.distinctUntilChanged)());
    }
    /**
     * Observable stream of hold state changes
     */
    get isHeld$() {
        return this._isHeld.asObservable().pipe((0, operators_1.distinctUntilChanged)());
    }
    /**
     * Observable stream of call duration changes (in seconds)
     */
    get duration$() {
        return this._duration.asObservable().pipe((0, operators_1.distinctUntilChanged)());
    }
    /**
     * Observable that emits true when the call can be answered
     */
    get canAnswer$() {
        return this.callState$.pipe((0, operators_1.map)((state) => call_state_1.CallStateHelpers.canAnswer(state)), (0, operators_1.distinctUntilChanged)());
    }
    /**
     * Observable that emits true when the call can be hung up
     */
    get canHangup$() {
        return this.callState$.pipe((0, operators_1.map)((state) => call_state_1.CallStateHelpers.canHangup(state)), (0, operators_1.distinctUntilChanged)());
    }
    /**
     * Observable that emits true when the call can be put on hold
     */
    get canHold$() {
        return this.callState$.pipe((0, operators_1.map)((state) => call_state_1.CallStateHelpers.canHold(state)), (0, operators_1.distinctUntilChanged)());
    }
    /**
     * Observable that emits true when the call can be resumed from hold
     */
    get canResume$() {
        return this.callState$.pipe((0, operators_1.map)((state) => call_state_1.CallStateHelpers.canResume(state)), (0, operators_1.distinctUntilChanged)());
    }
    /**
     * Answer the incoming call
     * @param customHeaders Optional custom headers to include with the answer
     */
    async answer(customHeaders) {
        if (!call_state_1.CallStateHelpers.canAnswer(this.currentState)) {
            throw new Error(`Cannot answer call in state: ${this.currentState}`);
        }
        try {
            // On iOS, use CallKit coordinator for proper audio session handling
            if (react_native_1.Platform.OS === 'ios') {
                const { callKitCoordinator } = await Promise.resolve().then(() => __importStar(require('../callkit/callkit-coordinator')));
                if (callKitCoordinator.isAvailable()) {
                    console.log('Call: Using CallKit coordinator to answer call (iOS)');
                    await callKitCoordinator.answerCallFromUI(this._telnyxCall);
                    return;
                }
            }
            // Fallback for Android or when CallKit is not available
            console.log('Call: Setting state to CONNECTING before answering');
            this._callState.next(call_state_1.TelnyxCallState.CONNECTING);
            // Pass custom headers to the underlying Telnyx call
            await this._telnyxCall.answer(customHeaders);
        }
        catch (error) {
            console.error('Failed to answer call:', error);
            throw error;
        }
    }
    /**
     * Hang up the call
     * @param customHeaders Optional custom headers to include with the hangup request
     */
    async hangup(customHeaders) {
        if (!call_state_1.CallStateHelpers.canHangup(this.currentState)) {
            throw new Error(`Cannot hang up call in state: ${this.currentState}`);
        }
        try {
            // On iOS, use CallKit coordinator for proper CallKit cleanup
            if (react_native_1.Platform.OS === 'ios') {
                const { callKitCoordinator } = await Promise.resolve().then(() => __importStar(require('../callkit/callkit-coordinator')));
                if (callKitCoordinator.isAvailable()) {
                    console.log('Call: Using CallKit coordinator to end call (iOS)');
                    await callKitCoordinator.endCallFromUI(this._telnyxCall);
                    return;
                }
            }
            // Fallback for Android or when CallKit is not available
            await this._telnyxCall.hangup(customHeaders);
            // On Android, also notify the native side to hide ongoing notification
            if (react_native_1.Platform.OS === 'android') {
                try {
                    const { VoicePnBridge } = await Promise.resolve().then(() => __importStar(require('../internal/voice-pn-bridge')));
                    await VoicePnBridge.endCall(this._callId);
                    console.log('Call: Notified Android to hide ongoing notification');
                }
                catch (error) {
                    console.error('Call: Failed to notify Android about call end:', error);
                    // Don't fail the hangup if notification hiding fails
                }
            }
        }
        catch (error) {
            console.error('Failed to hang up call:', error);
            throw error;
        }
    }
    /**
     * Put the call on hold
     */
    async hold() {
        if (!call_state_1.CallStateHelpers.canHold(this.currentState)) {
            throw new Error(`Cannot hold call in state: ${this.currentState}`);
        }
        try {
            await this._telnyxCall.hold();
        }
        catch (error) {
            console.error('Failed to hold call:', error);
            throw error;
        }
    }
    /**
     * Resume the call from hold
     */
    async resume() {
        if (!call_state_1.CallStateHelpers.canResume(this.currentState)) {
            throw new Error(`Cannot resume call in state: ${this.currentState}`);
        }
        try {
            await this._telnyxCall.unhold();
        }
        catch (error) {
            console.error('Failed to resume call:', error);
            throw error;
        }
    }
    /**
     * Mute the call
     */
    async mute() {
        if (!call_state_1.CallStateHelpers.canToggleMute(this.currentState)) {
            throw new Error(`Cannot mute call in state: ${this.currentState}`);
        }
        try {
            this._telnyxCall.mute();
            this._isMuted.next(true);
        }
        catch (error) {
            console.error('Failed to mute call:', error);
            throw error;
        }
    }
    /**
     * Unmute the call
     */
    async unmute() {
        if (!call_state_1.CallStateHelpers.canToggleMute(this.currentState)) {
            throw new Error(`Cannot unmute call in state: ${this.currentState}`);
        }
        try {
            this._telnyxCall.unmute();
            this._isMuted.next(false);
        }
        catch (error) {
            console.error('Failed to unmute call:', error);
            throw error;
        }
    }
    /**
     * Toggle mute state
     */
    async toggleMute() {
        if (this.currentIsMuted) {
            await this.unmute();
        }
        else {
            await this.mute();
        }
    }
    /**
     * Set the call to connecting state (used for push notification calls when answered via CallKit)
     * @internal
     */
    setConnecting() {
        console.log('Call: Setting state to CONNECTING for push notification answer');
        this._callState.next(call_state_1.TelnyxCallState.CONNECTING);
    }
    /**
     * Clean up resources when the call is disposed
     */
    dispose() {
        this._stopDurationTimer();
        this._callState.complete();
        this._isMuted.complete();
        this._isHeld.complete();
        this._duration.complete();
    }
    /**
     * Set up listeners for the underlying Telnyx call
     */
    _setupCallListeners() {
        // Map Telnyx call states to our simplified states
        this._telnyxCall.on('telnyx.call.state', (call, state) => {
            const telnyxState = this._mapToTelnyxCallState(state);
            this._callState.next(telnyxState);
            // Start duration timer when call becomes active
            if (telnyxState === call_state_1.TelnyxCallState.ACTIVE && !this._startTime) {
                this._startDurationTimer();
                // Show ongoing call notification on Android when call becomes active
                // This covers both locally answered calls and calls that become active from remote side
                if (react_native_1.Platform.OS === 'android') {
                    (async () => {
                        try {
                            const { VoicePnBridge } = await Promise.resolve().then(() => __importStar(require('../internal/voice-pn-bridge')));
                            // Extract caller information based on call direction
                            let callerNumber;
                            let callerName;
                            if (this._isIncoming) {
                                // For incoming calls, use the remote caller ID (who's calling us)
                                callerNumber = this._telnyxCall.remoteCallerIdNumber;
                                callerName = this._telnyxCall.remoteCallerIdName;
                            }
                            else {
                                // For outgoing calls, use our own caller ID (what we're showing to them)
                                // These are the values we set when making the call
                                callerNumber = this._telnyxCall.localCallerIdNumber || this._originalCallerNumber;
                                callerName = this._telnyxCall.localCallerIdName || this._originalCallerName;
                            }
                            // Fallback logic for better notification display - avoid "Unknown" when possible
                            let displayName;
                            let displayNumber;
                            if (this._isIncoming) {
                                // For incoming calls: use caller name or fall back to caller number, then destination
                                displayName = callerName || callerNumber || this._destination;
                                displayNumber = callerNumber || this._destination;
                            }
                            else {
                                // For outgoing calls: use our caller ID or descriptive text
                                displayName = callerName || `${this._destination}`;
                                displayNumber = callerNumber || this._destination;
                            }
                            await VoicePnBridge.showOngoingCallNotification(displayName, displayNumber, this._callId);
                            console.log('Call: Showed ongoing call notification on Android (call active)', {
                                isIncoming: this._isIncoming,
                                callerName: displayName,
                                callerNumber: displayNumber,
                            });
                        }
                        catch (error) {
                            console.error('Call: Failed to show ongoing call notification on active:', error);
                        }
                    })();
                }
            }
            // Stop duration timer when call ends
            if (call_state_1.CallStateHelpers.isTerminated(telnyxState)) {
                this._stopDurationTimer();
                // Clean up ongoing call notification on Android when call ends
                if (react_native_1.Platform.OS === 'android') {
                    (async () => {
                        try {
                            const { VoicePnBridge } = await Promise.resolve().then(() => __importStar(require('../internal/voice-pn-bridge')));
                            await VoicePnBridge.endCall(this._callId);
                            console.log('Call: Cleaned up ongoing call notification (call terminated)');
                        }
                        catch (error) {
                            console.error('Call: Failed to clean up ongoing call notification on termination:', error);
                        }
                    })();
                }
            }
        });
    }
    /**
     * Map Telnyx SDK call states to our simplified call states
     */
    _mapToTelnyxCallState(telnyxState) {
        // This mapping will depend on the actual Telnyx SDK call states
        // For now, using a basic mapping - this should be updated based on actual SDK
        switch (telnyxState) {
            case 'ringing':
            case 'new':
                return call_state_1.TelnyxCallState.RINGING;
            case 'connecting':
                return call_state_1.TelnyxCallState.CONNECTING;
            case 'active':
            case 'answered':
                return call_state_1.TelnyxCallState.ACTIVE;
            case 'held':
                return call_state_1.TelnyxCallState.HELD;
            case 'ended':
            case 'hangup':
                return call_state_1.TelnyxCallState.ENDED;
            case 'failed':
            case 'rejected':
                return call_state_1.TelnyxCallState.FAILED;
            case 'dropped':
                return call_state_1.TelnyxCallState.DROPPED;
            default:
                console.warn(`Unknown call state: ${telnyxState}`);
                return call_state_1.TelnyxCallState.RINGING;
        }
    }
    /**
     * Start the duration timer
     */
    _startDurationTimer() {
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
    _stopDurationTimer() {
        if (this._durationTimer) {
            clearInterval(this._durationTimer);
            this._durationTimer = undefined;
        }
    }
}
exports.Call = Call;
