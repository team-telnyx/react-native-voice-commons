import { EmitterSubscription } from 'react-native';
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
  getPendingCallAction(): Promise<{
    action: string | null;
    callId: string | null;
    timestamp: number | null;
  }>;
  clearPendingCallAction(): Promise<boolean>;
  endCall(callId: string | null): Promise<boolean>;
  showOngoingCallNotification(
    callerName: string | null,
    callerNumber: string | null,
    callId: string | null
  ): Promise<boolean>;
  hideOngoingCallNotification(): Promise<boolean>;
  hideIncomingCallNotification(): Promise<boolean>;
  getVoipToken(): Promise<string | null>;
  getPendingVoipPush(): Promise<string | null>;
  clearPendingVoipPush(): Promise<boolean>;
  getPendingVoipAction(): Promise<string | null>;
  clearPendingVoipAction(): Promise<boolean>;
}
declare const NativeBridge: VoicePnBridgeInterface;
/**
 * Enhanced VoicePnBridge with call control and event handling capabilities
 */
export declare class VoicePnBridge {
  /**
   * Get any pending push notification action from native side
   */
  static getPendingPushAction(): Promise<{
    action?: string;
    metadata?: string;
  }>;
  /**
   * Set a pending push notification action to native side
   */
  static setPendingPushAction(action: string, metadata: string): Promise<boolean>;
  /**
   * Get any pending call action from native side (reliable polling pattern)
   */
  static getPendingCallAction(): Promise<{
    action?: string;
    callId?: string;
    timestamp?: number;
  }>;
  /**
   * Clear any pending call action
   */
  static clearPendingCallAction(): Promise<boolean>;
  /**
   * Clear any pending push notification action
   */
  static clearPendingPushAction(): Promise<boolean>;
  /**
   * React Native → Android: End/hang up the current call
   * This will hide the ongoing call notification and notify the native side
   */
  static endCall(callId?: string): Promise<boolean>;
  /**
   * React Native → Android: Show ongoing call notification to keep app alive
   * Should be called when a call becomes active to prevent background termination
   */
  static showOngoingCallNotification(
    callerName?: string,
    callerNumber?: string,
    callId?: string
  ): Promise<boolean>;
  /**
   * React Native → Android: Hide ongoing call notification
   * Should be called when a call ends to clean up notifications
   */
  static hideOngoingCallNotification(): Promise<boolean>;
  /**
   * React Native → Android: Hide incoming call notification
   * Useful for dismissing notifications when call is answered/rejected in app
   */
  static hideIncomingCallNotification(): Promise<boolean>;
  /**
   * Get VoIP token from native storage
   */
  static getVoipToken(): Promise<string | null>;
  /**
   * Get pending VoIP push from native storage
   */
  static getPendingVoipPush(): Promise<string | null>;
  /**
   * Clear pending VoIP push from native storage
   */
  static clearPendingVoipPush(): Promise<boolean>;
  /**
   * Get pending VoIP action from native storage
   */
  static getPendingVoipAction(): Promise<string | null>;
  /**
   * Clear pending VoIP action from native storage
   */
  static clearPendingVoipAction(): Promise<boolean>;
  /**
   * Android → React Native: Listen for immediate call action events from notification buttons
   * Use this for active calls where immediate response is needed (e.g., ending ongoing calls)
   */
  static addCallActionListener(listener: (event: CallActionEvent) => void): EmitterSubscription;
  /**
   * Remove call action listener
   */
  static removeCallActionListener(subscription: EmitterSubscription): void;
  /**
   * Remove all call action listeners
   */
  static removeAllCallActionListeners(): void;
}
export { NativeBridge as VoicePnBridgeNative };
