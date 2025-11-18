import { NativeModules, DeviceEventEmitter, EmitterSubscription } from 'react-native';

export interface CallActionEvent {
  action: string;
  callId?: string;
  timestamp: number;
}

export interface VoicePnBridgeInterface {
  getPendingPushAction(): Promise<{
    action: string | null;
    metadata: string | null;
  }>;
  setPendingPushAction(action: string, metadata: string): Promise<boolean>;
  clearPendingPushAction(): Promise<boolean>;
  
  // Call action methods (reliable @ReactMethod pattern)
  getPendingCallAction(): Promise<{
    action: string | null;
    callId: string | null;
    timestamp: number | null;
  }>;
  clearPendingCallAction(): Promise<boolean>;
  
  // Call control methods (Android specific)
  endCall(callId: string | null): Promise<boolean>;
  showOngoingCallNotification(callerName: string | null, callerNumber: string | null, callId: string | null): Promise<boolean>;
  hideOngoingCallNotification(): Promise<boolean>;
  hideIncomingCallNotification(): Promise<boolean>;
  
  // Additional UserDefaults methods
  getVoipToken(): Promise<string | null>;
  getPendingVoipPush(): Promise<string | null>;
  clearPendingVoipPush(): Promise<boolean>;
  getPendingVoipAction(): Promise<string | null>;
  clearPendingVoipAction(): Promise<boolean>;
}

const NativeBridge: VoicePnBridgeInterface = NativeModules.VoicePnBridge;

/**
 * Enhanced VoicePnBridge with call control and event handling capabilities
 */
export class VoicePnBridge {
  /**
   * Get any pending push notification action from native side
   */
  static async getPendingPushAction(): Promise<{ action?: string; metadata?: string }> {
    try {
      const result = await NativeBridge.getPendingPushAction();
      return {
        action: result?.action || undefined,
        metadata: result?.metadata || undefined,
      };
    } catch (error) {
      console.error('VoicePnBridge: Error getting pending push action:', error);
      return {};
    }
  }

  /**
   * Set a pending push notification action to native side
   */
  static async setPendingPushAction(action: string, metadata: string): Promise<boolean> {
    try {
      return await NativeBridge.setPendingPushAction(action, metadata);
    } catch (error) {
      console.error('VoicePnBridge: Error setting pending push action:', error);
      return false;
    }
  }

  /**
   * Get any pending call action from native side (reliable polling pattern)
   */
  static async getPendingCallAction(): Promise<{
    action?: string;
    callId?: string;
    timestamp?: number;
  }> {
    try {
      const result = await NativeBridge.getPendingCallAction();
      return {
        action: result?.action || undefined,
        callId: result?.callId || undefined,
        timestamp: result?.timestamp || undefined,
      };
    } catch (error) {
      console.error('VoicePnBridge: Error getting pending call action:', error);
      return {};
    }
  }

  /**
   * Clear any pending call action
   */
  static async clearPendingCallAction(): Promise<boolean> {
    try {
      return await NativeBridge.clearPendingCallAction();
    } catch (error) {
      console.error('VoicePnBridge: Error clearing pending call action:', error);
      return false;
    }
  }

  /**
   * Clear any pending push notification action
   */
  static async clearPendingPushAction(): Promise<boolean> {
    try {
      return await NativeBridge.clearPendingPushAction();
    } catch (error) {
      console.error('VoicePnBridge: Error clearing pending push action:', error);
      return false;
    }
  }

  /**
   * React Native → Android: End/hang up the current call
   * This will hide the ongoing call notification and notify the native side
   */
  static async endCall(callId?: string): Promise<boolean> {
    try {
      return await NativeBridge.endCall(callId || null);
    } catch (error) {
      console.error('VoicePnBridge: Error ending call:', error);
      return false;
    }
  }

  /**
   * React Native → Android: Show ongoing call notification to keep app alive
   * Should be called when a call becomes active to prevent background termination
   */
  static async showOngoingCallNotification(
    callerName?: string,
    callerNumber?: string,
    callId?: string
  ): Promise<boolean> {
    try {
      return await NativeBridge.showOngoingCallNotification(
        callerName || null,
        callerNumber || null,
        callId || null
      );
    } catch (error) {
      console.error('VoicePnBridge: Error showing ongoing call notification:', error);
      return false;
    }
  }

  /**
   * React Native → Android: Hide ongoing call notification
   * Should be called when a call ends to clean up notifications
   */
  static async hideOngoingCallNotification(): Promise<boolean> {
    try {
      return await NativeBridge.hideOngoingCallNotification();
    } catch (error) {
      console.error('VoicePnBridge: Error hiding ongoing call notification:', error);
      return false;
    }
  }

  /**
   * React Native → Android: Hide incoming call notification
   * Useful for dismissing notifications when call is answered/rejected in app
   */
  static async hideIncomingCallNotification(): Promise<boolean> {
    try {
      return await NativeBridge.hideIncomingCallNotification();
    } catch (error) {
      console.error('VoicePnBridge: Error hiding incoming call notification:', error);
      return false;
    }
  }

  /**
   * Get VoIP token from native storage
   */
  static async getVoipToken(): Promise<string | null> {
    try {
      return await NativeBridge.getVoipToken();
    } catch (error) {
      console.error('VoicePnBridge: Error getting VoIP token:', error);
      return null;
    }
  }

  /**
   * Get pending VoIP push from native storage
   */
  static async getPendingVoipPush(): Promise<string | null> {
    try {
      return await NativeBridge.getPendingVoipPush();
    } catch (error) {
      console.error('VoicePnBridge: Error getting pending VoIP push:', error);
      return null;
    }
  }

  /**
   * Clear pending VoIP push from native storage
   */
  static async clearPendingVoipPush(): Promise<boolean> {
    try {
      return await NativeBridge.clearPendingVoipPush();
    } catch (error) {
      console.error('VoicePnBridge: Error clearing pending VoIP push:', error);
      return false;
    }
  }

  /**
   * Get pending VoIP action from native storage
   */
  static async getPendingVoipAction(): Promise<string | null> {
    try {
      return await NativeBridge.getPendingVoipAction();
    } catch (error) {
      console.error('VoicePnBridge: Error getting pending VoIP action:', error);
      return null;
    }
  }

  /**
   * Clear pending VoIP action from native storage
   */
  static async clearPendingVoipAction(): Promise<boolean> {
    try {
      return await NativeBridge.clearPendingVoipAction();
    } catch (error) {
      console.error('VoicePnBridge: Error clearing pending VoIP action:', error);
      return false;
    }
  }

  /**
   * Android → React Native: Listen for immediate call action events from notification buttons
   * Use this for active calls where immediate response is needed (e.g., ending ongoing calls)
   */
  static addCallActionListener(
    listener: (event: CallActionEvent) => void
  ): EmitterSubscription {
    return DeviceEventEmitter.addListener('TelnyxCallAction', listener);
  }

  /**
   * Remove call action listener
   */
  static removeCallActionListener(subscription: EmitterSubscription): void {
    subscription.remove();
  }

  /**
   * Remove all call action listeners
   */
  static removeAllCallActionListeners(): void {
    DeviceEventEmitter.removeAllListeners('TelnyxCallAction');
  }
}

// Export the native bridge for direct access if needed
export { NativeBridge as VoicePnBridgeNative };
