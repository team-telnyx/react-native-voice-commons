import { Platform } from 'react-native';
import CallKit, { CallEndReason } from '../callkit/callkit';
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
export class CallKitManager {
  private _callMappings = new Map<string, string>(); // Call ID -> CallKit UUID
  private _reverseCallMappings = new Map<string, string>(); // CallKit UUID -> Call ID
  private _isEnabled = false;
  private _callMap?: Map<string, Call>; // Reference to call map from call state controller

  constructor() {
    // DISABLED: Using external CallKit implementations (useCallKit, useCallKitCoordinator)
    this._isEnabled = false; // Disable to prevent conflicts
    console.log('🔧 CallKitManager: Initialized');
    console.log('🔧 CallKitManager: Platform.OS =', Platform.OS);
    console.log('🔧 CallKitManager: CallKit.isAvailable() =', CallKit.isAvailable());
    console.log(
      '🔧 CallKitManager: _isEnabled =',
      this._isEnabled,
      '(DISABLED to use external CallKit)'
    );

    // DISABLED: Conflicts with external CallKit implementations (useCallKit, useCallKitCoordinator)
    // if (this._isEnabled) {
    //   this._setupCallKitEventListeners();
    // }
    console.log(
      '🔧 CallKitManager: Automatic CallKit integration DISABLED - using external CallKit implementations'
    );
  }

  /**
   * Set up CallKit event listeners to handle user actions
   */
  private _setupCallKitEventListeners(): void {
    console.log('🔧 CallKitManager: Setting up CallKit event listeners');

    // Listen for answer actions from CallKit
    CallKit.onAnswerCall((event) => {
      console.log('📞 CallKitManager: CallKit answer event received:', event);
      this._handleCallKitAnswer(event.callUUID);
    });

    // Listen for end actions from CallKit
    CallKit.onEndCall((event) => {
      console.log('📞 CallKitManager: CallKit end event received:', event);
      this._handleCallKitEnd(event.callUUID);
    });

    console.log('🔧 CallKitManager: CallKit event listeners set up');
  }

  /**
   * Initialize CallKit integration
   */
  initialize(onAnswerCall: (callId: string) => void, onEndCall: (callId: string) => void) {
    if (!this._isEnabled) return;

    try {
      // This would need to be called from a React component context
      // For now, we'll handle this differently in the call-state-controller
      console.log('CallKitManager: CallKit integration initialized');
    } catch (error) {
      console.warn('CallKitManager: Failed to initialize CallKit:', error);
      this._isEnabled = false;
    }
  }

  /**
   * Handle outgoing call - start CallKit session
   */
  async handleOutgoingCall(call: Call): Promise<string | null> {
    console.log('🔵 CallKitManager.handleOutgoingCall() CALLED');
    console.log('🔵 CallKitManager: call.callId =', call.callId);
    console.log('🔵 CallKitManager: call.destination =', call.destination);
    console.log('🔵 CallKitManager: call.isIncoming =', call.isIncoming);
    console.log('🔵 CallKitManager: _isEnabled =', this._isEnabled);

    if (!this._isEnabled) {
      console.log('🔴 CallKitManager: CallKit NOT ENABLED - skipping outgoing call');
      return null;
    }

    try {
      console.log('🔵 CallKitManager: Starting CallKit session for outgoing call:', call.callId);

      const callKitUUID = CallKit.generateCallUUID();
      console.log('🔵 CallKitManager: Generated CallKit UUID:', callKitUUID);

      // Call the native CallKit bridge
      console.log('🔵 CallKitManager: Calling native CallKit.startOutgoingCall...');
      const success = await CallKit.startOutgoingCall(
        callKitUUID,
        call.destination,
        call.destination // Using destination as display name for now
      );

      if (success) {
        console.log('� CallKitManager: Native CallKit.startOutgoingCall SUCCESS!');
        this._callMappings.set(call.callId, callKitUUID);
        console.log('� CallKitManager: Stored call mapping:', call.callId, '->', callKitUUID);
        return callKitUUID;
      } else {
        console.log('� CallKitManager: Native CallKit.startOutgoingCall FAILED');
        return null;
      }
    } catch (error) {
      console.error('🔴 CallKitManager: Failed to start outgoing call:', error);
      return null;
    }
  }

  /**
   * Handle incoming call - show CallKit UI
   */
  async handleIncomingCall(call: Call): Promise<string | null> {
    console.log('🟡 CallKitManager.handleIncomingCall() CALLED');
    console.log('🟡 CallKitManager: call.callId =', call.callId);
    console.log('🟡 CallKitManager: call.destination =', call.destination);
    console.log('🟡 CallKitManager: call.isIncoming =', call.isIncoming);
    console.log('🟡 CallKitManager: _isEnabled =', this._isEnabled);

    if (!this._isEnabled) {
      console.log('🔴 CallKitManager: CallKit NOT ENABLED - skipping incoming call');
      return null;
    }

    try {
      console.log('🟡 CallKitManager: Showing CallKit UI for incoming call:', call.callId);

      const callKitUUID = CallKit.generateCallUUID();
      console.log('🟡 CallKitManager: Generated CallKit UUID for incoming call:', callKitUUID);

      // Call the native CallKit bridge
      console.log('🟡 CallKitManager: Calling native CallKit.reportIncomingCall...');

      // For incoming calls, the call.destination contains the caller number
      // We should use a more descriptive name if available
      const handle = call.destination;
      const displayName = call.destination; // For now, use the number as display name too

      console.log('🟡 CallKitManager: Using handle:', handle, 'displayName:', displayName);

      const success = await CallKit.reportIncomingCall(callKitUUID, handle, displayName);

      if (success) {
        console.log('� CallKitManager: Native CallKit.reportIncomingCall SUCCESS!');
        this._callMappings.set(call.callId, callKitUUID);
        console.log(
          '� CallKitManager: Stored incoming call mapping:',
          call.callId,
          '->',
          callKitUUID
        );
        return callKitUUID;
      } else {
        console.log('� CallKitManager: Native CallKit.reportIncomingCall FAILED');
        return null;
      }
    } catch (error) {
      console.error('🔴 CallKitManager: Failed to show incoming call:', error);
      return null;
    }
  }

  /**
   * Update call state in CallKit
   */
  async updateCallState(call: Call, state: TelnyxCallState): Promise<void> {
    if (!this._isEnabled) return;

    const callKitUUID = this._callMappings.get(call.callId);
    if (!callKitUUID) return;

    try {
      console.log(`🔧 CallKitManager: Updating CallKit state for call ${call.callId} to ${state}`);
      console.log(`🔧 CallKitManager: CallKit UUID: ${callKitUUID}`);

      switch (state) {
        case TelnyxCallState.ACTIVE:
          console.log('🟢 CallKitManager: Reporting call connected to CallKit');
          await CallKit.reportCallConnected(callKitUUID);
          break;
        case TelnyxCallState.ENDED:
          console.log('🔴 CallKitManager: Reporting call ended to CallKit (remote ended)');
          await CallKit.reportCallEnded(callKitUUID, CallEndReason.RemoteEnded);
          this._callMappings.delete(call.callId);
          break;
        case TelnyxCallState.FAILED:
          console.log('🔴 CallKitManager: Reporting call ended to CallKit (failed)');
          await CallKit.reportCallEnded(callKitUUID, CallEndReason.Failed);
          this._callMappings.delete(call.callId);
          break;
        case TelnyxCallState.RINGING:
          console.log('🟡 CallKitManager: Call ringing - no CallKit update needed');
          break;
        default:
          console.log(`🔧 CallKitManager: Unhandled state: ${state}`);
          break;
      }
    } catch (error) {
      console.error('🔴 CallKitManager: Failed to update call state:', error);
    }
  }

  /**
   * End CallKit session
   */
  async endCall(call: Call): Promise<void> {
    if (!this._isEnabled) return;

    const callKitUUID = this._callMappings.get(call.callId);
    if (!callKitUUID) return;

    try {
      console.log('🔴 CallKitManager: Ending CallKit session for call:', call.callId);
      console.log('🔴 CallKitManager: CallKit UUID:', callKitUUID);

      // Report call ended with user-initiated reason
      await CallKit.reportCallEnded(callKitUUID, CallEndReason.RemoteEnded);
      this._callMappings.delete(call.callId);

      console.log('🔴 CallKitManager: CallKit session ended successfully');
    } catch (error) {
      console.error('🔴 CallKitManager: Failed to end call:', error);
    }
  }

  /**
   * Handle CallKit answer action
   */
  private _handleCallKitAnswer(callKitUUID: string): void {
    console.log('📞 CallKitManager: Handling CallKit answer for UUID:', callKitUUID);

    // Find the call ID from the CallKit UUID
    const callId = this._reverseCallMappings.get(callKitUUID);
    if (!callId) {
      console.error('🔴 CallKitManager: No call found for CallKit UUID:', callKitUUID);
      return;
    }

    console.log('📞 CallKitManager: Found call ID:', callId);

    // Find the call object and answer it
    if (this._callMap) {
      const call = this._callMap.get(callId);
      if (call) {
        console.log('📞 CallKitManager: Answering call:', callId);
        call.answer();
      } else {
        console.error('🔴 CallKitManager: Call object not found for ID:', callId);
      }
    } else {
      console.error('🔴 CallKitManager: Call map not available');
    }
  }

  /**
   * Handle CallKit end action
   */
  private _handleCallKitEnd(callKitUUID: string): void {
    console.log('📞 CallKitManager: Handling CallKit end for UUID:', callKitUUID);

    // Find the call ID from the CallKit UUID
    const callId = this._reverseCallMappings.get(callKitUUID);
    if (!callId) {
      console.error('🔴 CallKitManager: No call found for CallKit UUID:', callKitUUID);
      return;
    }

    console.log('📞 CallKitManager: Found call ID:', callId);

    // Find the call object and hang up
    if (this._callMap) {
      const call = this._callMap.get(callId);
      if (call) {
        console.log('📞 CallKitManager: Hanging up call:', callId);
        call.hangup();
      } else {
        console.error('🔴 CallKitManager: Call object not found for ID:', callId);
      }
    } else {
      console.error('🔴 CallKitManager: Call map not available');
    }
  }

  /**
   * Set the call map reference for handling CallKit actions
   */
  setCallMap(callMap: Map<string, Call>): void {
    this._callMap = callMap;
    console.log('🔧 CallKitManager: Call map reference set');
  }

  /**
   * Check if CallKit is available
   */
  get isAvailable(): boolean {
    return this._isEnabled;
  }

  /**
   * Get CallKit UUID for a call
   */
  getCallKitUUID(callId: string): string | null {
    return this._callMappings.get(callId) || null;
  }

  /**
   * Generate a UUID for CallKit
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Dispose of the CallKit manager
   */
  dispose() {
    this._callMappings.clear();
  }
}
