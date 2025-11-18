"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoicePnBridgeNative = exports.VoicePnBridge = void 0;
const react_native_1 = require("react-native");
const NativeBridge = react_native_1.NativeModules.VoicePnBridge;
exports.VoicePnBridgeNative = NativeBridge;
/**
 * Enhanced VoicePnBridge with call control and event handling capabilities
 */
class VoicePnBridge {
    /**
     * Get any pending push notification action from native side
     */
    static async getPendingPushAction() {
        try {
            const result = await NativeBridge.getPendingPushAction();
            return {
                action: result?.action || undefined,
                metadata: result?.metadata || undefined,
            };
        }
        catch (error) {
            console.error('VoicePnBridge: Error getting pending push action:', error);
            return {};
        }
    }
    /**
     * Set a pending push notification action to native side
     */
    static async setPendingPushAction(action, metadata) {
        try {
            return await NativeBridge.setPendingPushAction(action, metadata);
        }
        catch (error) {
            console.error('VoicePnBridge: Error setting pending push action:', error);
            return false;
        }
    }
    /**
     * Get any pending call action from native side (reliable polling pattern)
     */
    static async getPendingCallAction() {
        try {
            const result = await NativeBridge.getPendingCallAction();
            return {
                action: result?.action || undefined,
                callId: result?.callId || undefined,
                timestamp: result?.timestamp || undefined,
            };
        }
        catch (error) {
            console.error('VoicePnBridge: Error getting pending call action:', error);
            return {};
        }
    }
    /**
     * Clear any pending call action
     */
    static async clearPendingCallAction() {
        try {
            return await NativeBridge.clearPendingCallAction();
        }
        catch (error) {
            console.error('VoicePnBridge: Error clearing pending call action:', error);
            return false;
        }
    }
    /**
     * Clear any pending push notification action
     */
    static async clearPendingPushAction() {
        try {
            return await NativeBridge.clearPendingPushAction();
        }
        catch (error) {
            console.error('VoicePnBridge: Error clearing pending push action:', error);
            return false;
        }
    }
    /**
     * React Native → Android: End/hang up the current call
     * This will hide the ongoing call notification and notify the native side
     */
    static async endCall(callId) {
        try {
            return await NativeBridge.endCall(callId || null);
        }
        catch (error) {
            console.error('VoicePnBridge: Error ending call:', error);
            return false;
        }
    }
    /**
     * React Native → Android: Show ongoing call notification to keep app alive
     * Should be called when a call becomes active to prevent background termination
     */
    static async showOngoingCallNotification(callerName, callerNumber, callId) {
        try {
            return await NativeBridge.showOngoingCallNotification(callerName || null, callerNumber || null, callId || null);
        }
        catch (error) {
            console.error('VoicePnBridge: Error showing ongoing call notification:', error);
            return false;
        }
    }
    /**
     * React Native → Android: Hide ongoing call notification
     * Should be called when a call ends to clean up notifications
     */
    static async hideOngoingCallNotification() {
        try {
            return await NativeBridge.hideOngoingCallNotification();
        }
        catch (error) {
            console.error('VoicePnBridge: Error hiding ongoing call notification:', error);
            return false;
        }
    }
    /**
     * React Native → Android: Hide incoming call notification
     * Useful for dismissing notifications when call is answered/rejected in app
     */
    static async hideIncomingCallNotification() {
        try {
            return await NativeBridge.hideIncomingCallNotification();
        }
        catch (error) {
            console.error('VoicePnBridge: Error hiding incoming call notification:', error);
            return false;
        }
    }
    /**
     * Get VoIP token from native storage
     */
    static async getVoipToken() {
        try {
            return await NativeBridge.getVoipToken();
        }
        catch (error) {
            console.error('VoicePnBridge: Error getting VoIP token:', error);
            return null;
        }
    }
    /**
     * Get pending VoIP push from native storage
     */
    static async getPendingVoipPush() {
        try {
            return await NativeBridge.getPendingVoipPush();
        }
        catch (error) {
            console.error('VoicePnBridge: Error getting pending VoIP push:', error);
            return null;
        }
    }
    /**
     * Clear pending VoIP push from native storage
     */
    static async clearPendingVoipPush() {
        try {
            return await NativeBridge.clearPendingVoipPush();
        }
        catch (error) {
            console.error('VoicePnBridge: Error clearing pending VoIP push:', error);
            return false;
        }
    }
    /**
     * Get pending VoIP action from native storage
     */
    static async getPendingVoipAction() {
        try {
            return await NativeBridge.getPendingVoipAction();
        }
        catch (error) {
            console.error('VoicePnBridge: Error getting pending VoIP action:', error);
            return null;
        }
    }
    /**
     * Clear pending VoIP action from native storage
     */
    static async clearPendingVoipAction() {
        try {
            return await NativeBridge.clearPendingVoipAction();
        }
        catch (error) {
            console.error('VoicePnBridge: Error clearing pending VoIP action:', error);
            return false;
        }
    }
    /**
     * Android → React Native: Listen for immediate call action events from notification buttons
     * Use this for active calls where immediate response is needed (e.g., ending ongoing calls)
     */
    static addCallActionListener(listener) {
        return react_native_1.DeviceEventEmitter.addListener('TelnyxCallAction', listener);
    }
    /**
     * Remove call action listener
     */
    static removeCallActionListener(subscription) {
        subscription.remove();
    }
    /**
     * Remove all call action listeners
     */
    static removeAllCallActionListeners() {
        react_native_1.DeviceEventEmitter.removeAllListeners('TelnyxCallAction');
    }
}
exports.VoicePnBridge = VoicePnBridge;
