import { Call } from '@telnyx/react-native-voice-sdk';
import { TelnyxVoipClient } from '../telnyx-voip-client';
/**
 * CallKit Coordinator - Manages the proper CallKit-first flow for iOS
 *
 * This coordinator ensures that all call actions go through CallKit first,
 * which then triggers the appropriate WebRTC actions. This follows Apple's
 * guidelines for proper CallKit integration.
 */
declare class CallKitCoordinator {
  private static instance;
  private callMap;
  private processingCalls;
  private endedCalls;
  private connectedCalls;
  private isCallFromPush;
  private shouldAutoAnswerNextCall;
  private voipClient;
  static getInstance(): CallKitCoordinator;
  private constructor();
  private setupCallKitListeners;
  /**
   * Report an incoming call to CallKit (from push notification or socket)
   * For push notifications, the call is already reported - we just need to map it
   */
  reportIncomingCall(call: Call, callerName: string, callerNumber: string): Promise<string | null>;
  /**
   * Start an outgoing call through CallKit
   */
  startOutgoingCall(
    call: Call,
    destinationNumber: string,
    displayName?: string
  ): Promise<string | null>;
  /**
   * Answer a call from the app UI (CallKit-first approach)
   */
  answerCallFromUI(call: Call): Promise<boolean>;
  /**
   * End a call from the app UI (CallKit-first approach)
   */
  endCallFromUI(call: Call): Promise<boolean>;
  /**
   * Handle CallKit answer action (triggered by CallKit)
   */
  handleCallKitAnswer(callKitUUID: string, event?: any): Promise<void>;
  /**
   * Handle CallKit end action (triggered by CallKit)
   */
  private handleCallKitEnd;
  /**
   * Handle CallKit start action (triggered by CallKit for outgoing calls)
   */
  private handleCallKitStart;
  /**
   * Handle CallKit push received event
   * This allows us to coordinate between the push notification and any subsequent WebRTC calls
   */
  handleCallKitPushReceived(callKitUUID: string, event?: any): Promise<void>;
  /**
   * Handle push notification answer - when user answers from CallKit but we don't have a WebRTC call yet
   * This is the iOS equivalent of the Android FCM handler
   */
  private handlePushNotificationAnswer;
  /**
   * Handle push notification reject - when user rejects from CallKit but we don't have a WebRTC call yet
   * This is the iOS equivalent of the Android FCM handler reject
   */
  private handlePushNotificationReject;
  /**
   * Set up listeners for WebRTC call state changes
   */
  private setupWebRTCCallListeners;
  /**
   * Clean up call mappings and listeners
   */
  private cleanupCall;
  /**
   * Get CallKit UUID for a WebRTC call
   */
  getCallKitUUID(call: Call): string | null;
  /**
   * Get WebRTC call for a CallKit UUID
   */
  getWebRTCCall(callKitUUID: string): Call | null;
  /**
   * Link an existing CallKit call (from push notification) with a WebRTC call
   * This should be called when a WebRTC call arrives that corresponds to an existing CallKit call
   */
  linkExistingCallKitCall(call: Call, callKitUUID: string): void;
  /**
   * Set the VoIP client reference for triggering reconnection.
   *
   * @deprecated No longer needed — TelnyxVoiceApp now auto-wires the voipClient
   * on mount. Kept for backwards compatibility.
   */
  setVoipClient(voipClient: TelnyxVoipClient): void;
  /**
   * Helper method to clean up push notification state
   */
  private cleanupPushNotificationState;
  /**
   * Get reference to the SDK client (for queuing actions when call doesn't exist yet)
   */
  private getSDKClient;
  /**
   * Check if app is in background and disconnect client if no active calls
   */
  private checkBackgroundDisconnection;
  /**
   * Reset only flags (keeping active call mappings intact)
   */
  resetFlags(): void;
  /**
   * Check if there are any calls currently being processed by CallKit
   * This helps prevent premature flag resets during CallKit operations
   */
  hasProcessingCalls(): boolean;
  /**
   * Check if there's currently a call from push notification being processed
   * This helps prevent disconnection during push call handling
   */
  getIsCallFromPush(): boolean;
  /**
   * Check if CallKit is available and coordinator is active
   */
  isAvailable(): boolean;
}
export declare const callKitCoordinator: CallKitCoordinator;
export default callKitCoordinator;
