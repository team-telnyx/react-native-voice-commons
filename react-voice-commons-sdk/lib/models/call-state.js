"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallStateHelpers = exports.TelnyxCallState = void 0;
exports.isTelnyxCallState = isTelnyxCallState;
/**
 * Represents the state of a call in the Telnyx system.
 *
 * This enum provides a simplified view of call states, abstracting away
 * the complexity of the underlying SIP call states.
 */
var TelnyxCallState;
(function (TelnyxCallState) {
    /** Call is being initiated (outgoing) or received (incoming) */
    TelnyxCallState["RINGING"] = "RINGING";
    /** Call is connecting after being answered (usually from push notification) */
    TelnyxCallState["CONNECTING"] = "CONNECTING";
    /** Call has been answered and media is flowing */
    TelnyxCallState["ACTIVE"] = "ACTIVE";
    /** Call is on hold */
    TelnyxCallState["HELD"] = "HELD";
    /** Call has ended normally */
    TelnyxCallState["ENDED"] = "ENDED";
    /** Call failed to connect or was rejected */
    TelnyxCallState["FAILED"] = "FAILED";
    /** Call was dropped due to network issues */
    TelnyxCallState["DROPPED"] = "DROPPED";
})(TelnyxCallState || (exports.TelnyxCallState = TelnyxCallState = {}));
/**
 * Type guard to check if a value is a valid TelnyxCallState
 */
function isTelnyxCallState(value) {
    return Object.values(TelnyxCallState).includes(value);
}
/**
 * Helper functions to determine what actions are available in each state
 */
exports.CallStateHelpers = {
    /**
     * Can the call be answered in this state?
     */
    canAnswer(state) {
        return state === TelnyxCallState.RINGING;
    },
    /**
     * Can the call be hung up in this state?
     */
    canHangup(state) {
        return (state === TelnyxCallState.RINGING ||
            state === TelnyxCallState.CONNECTING ||
            state === TelnyxCallState.ACTIVE ||
            state === TelnyxCallState.HELD);
    },
    /**
     * Can the call be put on hold in this state?
     */
    canHold(state) {
        return state === TelnyxCallState.ACTIVE;
    },
    /**
     * Can the call be resumed from hold in this state?
     */
    canResume(state) {
        return state === TelnyxCallState.HELD;
    },
    /**
     * Can the call be muted/unmuted in this state?
     */
    canToggleMute(state) {
        return state === TelnyxCallState.ACTIVE || state === TelnyxCallState.HELD;
    },
    /**
     * Is the call in a terminated state?
     */
    isTerminated(state) {
        return (state === TelnyxCallState.ENDED ||
            state === TelnyxCallState.FAILED ||
            state === TelnyxCallState.DROPPED);
    },
    /**
     * Is the call in an active state (can have media)?
     */
    isActive(state) {
        return state === TelnyxCallState.ACTIVE || state === TelnyxCallState.HELD;
    },
    /**
     * Is the call in a connecting state (answered but not yet active)?
     */
    isConnecting(state) {
        return state === TelnyxCallState.CONNECTING;
    },
};
