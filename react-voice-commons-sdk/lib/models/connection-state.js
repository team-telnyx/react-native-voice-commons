"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelnyxConnectionState = void 0;
exports.isTelnyxConnectionState = isTelnyxConnectionState;
exports.canMakeCalls = canMakeCalls;
exports.isConnected = isConnected;
exports.isTransitioning = isTransitioning;
/**
 * Represents the connection state to the Telnyx platform.
 *
 * This enum provides a simplified view of the connection status,
 * abstracting away the complexity of the underlying WebSocket states.
 */
var TelnyxConnectionState;
(function (TelnyxConnectionState) {
    /** Initial state before any connection attempt */
    TelnyxConnectionState["DISCONNECTED"] = "DISCONNECTED";
    /** Attempting to establish connection */
    TelnyxConnectionState["CONNECTING"] = "CONNECTING";
    /** Successfully connected and authenticated */
    TelnyxConnectionState["CONNECTED"] = "CONNECTED";
    /** Connection lost, attempting to reconnect */
    TelnyxConnectionState["RECONNECTING"] = "RECONNECTING";
    /** Connection failed or authentication error */
    TelnyxConnectionState["ERROR"] = "ERROR";
})(TelnyxConnectionState || (exports.TelnyxConnectionState = TelnyxConnectionState = {}));
/**
 * Type guard to check if a value is a valid TelnyxConnectionState
 */
function isTelnyxConnectionState(value) {
    return Object.values(TelnyxConnectionState).includes(value);
}
/**
 * Helper function to determine if the connection state allows making calls
 */
function canMakeCalls(state) {
    return state === TelnyxConnectionState.CONNECTED;
}
/**
 * Helper function to determine if the connection state indicates an active connection
 */
function isConnected(state) {
    return state === TelnyxConnectionState.CONNECTED;
}
/**
 * Helper function to determine if the connection is in a transitional state
 */
function isTransitioning(state) {
    return state === TelnyxConnectionState.CONNECTING || state === TelnyxConnectionState.RECONNECTING;
}
