import { Call } from '../models/call';
import { TelnyxCallState } from '../models/call-state';
/**
 * Internal CallKit integration manager for react-voice-commons.
 *
 * This class automatically handles CallKit integration for all calls
 * without exposing complexity to the consumer components.
 *
 * @internal
 */
export declare class CallKitManager {
  private _callMappings;
  private _reverseCallMappings;
  private _isEnabled;
  private _callMap?;
  constructor();
  /**
   * Set up CallKit event listeners to handle user actions
   */
  private _setupCallKitEventListeners;
  /**
   * Initialize CallKit integration
   */
  initialize(onAnswerCall: (callId: string) => void, onEndCall: (callId: string) => void): void;
  /**
   * Handle outgoing call - start CallKit session
   */
  handleOutgoingCall(call: Call): Promise<string | null>;
  /**
   * Handle incoming call - show CallKit UI
   */
  handleIncomingCall(call: Call): Promise<string | null>;
  /**
   * Update call state in CallKit
   */
  updateCallState(call: Call, state: TelnyxCallState): Promise<void>;
  /**
   * End CallKit session
   */
  endCall(call: Call): Promise<void>;
  /**
   * Handle CallKit answer action
   */
  private _handleCallKitAnswer;
  /**
   * Handle CallKit end action
   */
  private _handleCallKitEnd;
  /**
   * Set the call map reference for handling CallKit actions
   */
  setCallMap(callMap: Map<string, Call>): void;
  /**
   * Check if CallKit is available
   */
  get isAvailable(): boolean;
  /**
   * Get CallKit UUID for a call
   */
  getCallKitUUID(callId: string): string | null;
  /**
   * Generate a UUID for CallKit
   */
  private generateUUID;
  /**
   * Dispose of the CallKit manager
   */
  dispose(): void;
}
