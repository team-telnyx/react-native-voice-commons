'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, '__esModule', { value: true });
exports.CallKitManager = void 0;
const react_native_1 = require('react-native');
const callkit_1 = __importStar(require('../callkit/callkit'));
const call_state_1 = require('../models/call-state');
/**
 * Internal CallKit integration manager for react-voice-commons.
 *
 * This class automatically handles CallKit integration for all calls
 * without exposing complexity to the consumer components.
 *
 * @internal
 */
class CallKitManager {
  constructor() {
    this._callMappings = new Map(); // Call ID -> CallKit UUID
    this._reverseCallMappings = new Map(); // CallKit UUID -> Call ID
    this._isEnabled = false;
    // DISABLED: Using external CallKit implementations (useCallKit, useCallKitCoordinator)
    this._isEnabled = false; // Disable to prevent conflicts
    console.log('🔧 CallKitManager: Initialized');
    console.log('🔧 CallKitManager: Platform.OS =', react_native_1.Platform.OS);
    console.log('🔧 CallKitManager: CallKit.isAvailable() =', callkit_1.default.isAvailable());
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
  _setupCallKitEventListeners() {
    console.log('🔧 CallKitManager: Setting up CallKit event listeners');
    // Listen for answer actions from CallKit
    callkit_1.default.onAnswerCall((event) => {
      console.log('📞 CallKitManager: CallKit answer event received:', event);
      this._handleCallKitAnswer(event.callUUID);
    });
    // Listen for end actions from CallKit
    callkit_1.default.onEndCall((event) => {
      console.log('📞 CallKitManager: CallKit end event received:', event);
      this._handleCallKitEnd(event.callUUID);
    });
    console.log('🔧 CallKitManager: CallKit event listeners set up');
  }
  /**
   * Initialize CallKit integration
   */
  initialize(onAnswerCall, onEndCall) {
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
  async handleOutgoingCall(call) {
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
      const callKitUUID = callkit_1.default.generateCallUUID();
      console.log('🔵 CallKitManager: Generated CallKit UUID:', callKitUUID);
      // Call the native CallKit bridge
      console.log('🔵 CallKitManager: Calling native CallKit.startOutgoingCall...');
      const success = await callkit_1.default.startOutgoingCall(
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
  async handleIncomingCall(call) {
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
      const callKitUUID = callkit_1.default.generateCallUUID();
      console.log('🟡 CallKitManager: Generated CallKit UUID for incoming call:', callKitUUID);
      // Call the native CallKit bridge
      console.log('🟡 CallKitManager: Calling native CallKit.reportIncomingCall...');
      // For incoming calls, the call.destination contains the caller number
      // We should use a more descriptive name if available
      const handle = call.destination;
      const displayName = call.destination; // For now, use the number as display name too
      console.log('🟡 CallKitManager: Using handle:', handle, 'displayName:', displayName);
      const success = await callkit_1.default.reportIncomingCall(callKitUUID, handle, displayName);
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
  async updateCallState(call, state) {
    if (!this._isEnabled) return;
    const callKitUUID = this._callMappings.get(call.callId);
    if (!callKitUUID) return;
    try {
      console.log(`🔧 CallKitManager: Updating CallKit state for call ${call.callId} to ${state}`);
      console.log(`🔧 CallKitManager: CallKit UUID: ${callKitUUID}`);
      switch (state) {
        case call_state_1.TelnyxCallState.ACTIVE:
          console.log('🟢 CallKitManager: Reporting call connected to CallKit');
          await callkit_1.default.reportCallConnected(callKitUUID);
          break;
        case call_state_1.TelnyxCallState.ENDED:
          console.log('🔴 CallKitManager: Reporting call ended to CallKit (remote ended)');
          await callkit_1.default.reportCallEnded(callKitUUID, callkit_1.CallEndReason.RemoteEnded);
          this._callMappings.delete(call.callId);
          break;
        case call_state_1.TelnyxCallState.FAILED:
          console.log('🔴 CallKitManager: Reporting call ended to CallKit (failed)');
          await callkit_1.default.reportCallEnded(callKitUUID, callkit_1.CallEndReason.Failed);
          this._callMappings.delete(call.callId);
          break;
        case call_state_1.TelnyxCallState.RINGING:
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
  async endCall(call) {
    if (!this._isEnabled) return;
    const callKitUUID = this._callMappings.get(call.callId);
    if (!callKitUUID) return;
    try {
      console.log('🔴 CallKitManager: Ending CallKit session for call:', call.callId);
      console.log('🔴 CallKitManager: CallKit UUID:', callKitUUID);
      // Report call ended with user-initiated reason
      await callkit_1.default.reportCallEnded(callKitUUID, callkit_1.CallEndReason.RemoteEnded);
      this._callMappings.delete(call.callId);
      console.log('🔴 CallKitManager: CallKit session ended successfully');
    } catch (error) {
      console.error('🔴 CallKitManager: Failed to end call:', error);
    }
  }
  /**
   * Handle CallKit answer action
   */
  _handleCallKitAnswer(callKitUUID) {
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
  _handleCallKitEnd(callKitUUID) {
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
  setCallMap(callMap) {
    this._callMap = callMap;
    console.log('🔧 CallKitManager: Call map reference set');
  }
  /**
   * Check if CallKit is available
   */
  get isAvailable() {
    return this._isEnabled;
  }
  /**
   * Get CallKit UUID for a call
   */
  getCallKitUUID(callId) {
    return this._callMappings.get(callId) || null;
  }
  /**
   * Generate a UUID for CallKit
   */
  generateUUID() {
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
exports.CallKitManager = CallKitManager;
