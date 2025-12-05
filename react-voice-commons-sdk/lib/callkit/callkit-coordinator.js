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
exports.callKitCoordinator = void 0;
const react_native_1 = require('react-native');
const callkit_1 = __importStar(require('./callkit'));
const voice_pn_bridge_1 = require('../internal/voice-pn-bridge');
/**
 * CallKit Coordinator - Manages the proper CallKit-first flow for iOS
 *
 * This coordinator ensures that all call actions go through CallKit first,
 * which then triggers the appropriate WebRTC actions. This follows Apple's
 * guidelines for proper CallKit integration.
 */
class CallKitCoordinator {
  static getInstance() {
    if (!CallKitCoordinator.instance) {
      CallKitCoordinator.instance = new CallKitCoordinator();
    }
    return CallKitCoordinator.instance;
  }
  constructor() {
    // Maps CallKit UUIDs to WebRTC calls
    this.callMap = new Map();
    // Tracks calls that are being processed to prevent duplicates
    this.processingCalls = new Set();
    // Tracks calls that have already been ended in CallKit to prevent duplicate reports
    this.endedCalls = new Set();
    // Tracks calls that have already been reported as connected to prevent duplicate reports
    this.connectedCalls = new Set();
    this.isCallFromPush = false;
    // Flag to auto-answer the next incoming call (set when answering push notifications via CallKit)
    this.shouldAutoAnswerNextCall = false;
    // Reference to the VoIP client for triggering reconnection when needed
    this.voipClient = null;
    if (react_native_1.Platform.OS === 'ios' && callkit_1.default.isAvailable()) {
      this.setupCallKitListeners();
    }
  }
  setupCallKitListeners() {
    // Handle CallKit answer actions
    callkit_1.default.onAnswerCall((event) => {
      this.handleCallKitAnswer(event.callUUID, event);
    });
    // Handle CallKit end actions
    callkit_1.default.onEndCall((event) => {
      this.handleCallKitEnd(event.callUUID, event);
    });
    // Handle CallKit start actions (for outgoing calls)
    callkit_1.default.onStartCall((event) => {
      this.handleCallKitStart(event.callUUID);
    });
    // Handle CallKit push received events
    callkit_1.default.onReceivePush((event) => {
      this.handleCallKitPushReceived(event.callUUID, event);
    });
  }
  /**
   * Report an incoming call to CallKit (from push notification or socket)
   * For push notifications, the call is already reported - we just need to map it
   */
  async reportIncomingCall(call, callerName, callerNumber) {
    if (react_native_1.Platform.OS !== 'ios' || !callkit_1.default.isAvailable()) {
      return null;
    }
    // This is a new call - report it to CallKit using the WebRTC call ID as CallKit UUID
    const callKitUUID = call.callId;
    console.log('CallKitCoordinator: Report Called called', {
      callKitUUID,
      webrtcCallId: call.callId,
      callerName,
      callerNumber,
      isCallFromPush: this.isCallFromPush,
    });
    this.setupWebRTCCallListeners(call, callKitUUID);
    this.callMap.set(callKitUUID, call);
    try {
      if (!this.isCallFromPush) {
        console.log('CallKitCoordinator: Reporting new incoming call to CallKit', {
          callKitUUID,
          webrtcCallId: call.callId,
          callerName,
          callerNumber,
          isCallFromPush: this.isCallFromPush,
        });
        const success = await callkit_1.default.reportIncomingCall(
          callKitUUID,
          callerNumber,
          callerName
        );
        if (success) {
          return callKitUUID;
        }
      }
      return null;
    } catch (error) {
      console.error('CallKitCoordinator: Failed to report incoming call', error);
      return null;
    }
  }
  /**
   * Start an outgoing call through CallKit
   */
  async startOutgoingCall(call, destinationNumber, displayName) {
    if (react_native_1.Platform.OS !== 'ios' || !callkit_1.default.isAvailable()) {
      return null;
    }
    const callKitUUID = call.callId;
    console.log('CallKitCoordinator: Starting outgoing call through CallKit', {
      callKitUUID,
      webrtcCallId: call.callId,
      destinationNumber,
      displayName,
    });
    try {
      const success = await callkit_1.default.startOutgoingCall(
        callKitUUID,
        destinationNumber,
        displayName || destinationNumber
      );
      if (success) {
        this.callMap.set(callKitUUID, call);
        this.setupWebRTCCallListeners(call, callKitUUID);
        call._callKitUUID = callKitUUID;
        return callKitUUID;
      }
      return null;
    } catch (error) {
      console.error('CallKitCoordinator: Failed to start outgoing call', error);
      return null;
    }
  }
  /**
   * Answer a call from the app UI (CallKit-first approach)
   */
  async answerCallFromUI(call) {
    // Use comprehensive UUID lookup that checks both maps and call properties
    const callKitUUID = this.getCallKitUUID(call);
    console.log(
      'CallKitCoordinator: Answering call from UI using CallKit answer simulation',
      callKitUUID
    );
    // Mark as processing to prevent duplicate actions
    this.processingCalls.add(callKitUUID);
    try {
      // Simulate the CallKit answer action, which will trigger our answer handler
      const success = await callkit_1.default.answerCall(callKitUUID);
      if (success) {
        // If CallKit answer fails, fallback to direct WebRTC answer
        if (this.isCallFromPush) {
          call.answer();
          this.isCallFromPush = false;
        }
        console.log('CallKitCoordinator: CallKit answer success');
      }
      return success;
    } catch (error) {
      console.error('CallKitCoordinator: Error answering call from UI', error);
      return false;
    } finally {
      this.processingCalls.delete(callKitUUID);
    }
  }
  /**
   * End a call from the app UI (CallKit-first approach)
   */
  async endCallFromUI(call) {
    // Use comprehensive UUID lookup that checks both maps and call properties
    const callKitUUID = this.getCallKitUUID(call);
    if (!callKitUUID) {
      console.warn('CallKitCoordinator: Cannot end call - no CallKit UUID found');
      // Fallback to direct WebRTC hangup
      call.hangup();
      return false;
    }
    console.log(
      'CallKitCoordinator: Ending call from UI - dismissing CallKit and hanging up WebRTC call',
      callKitUUID
    );
    // Mark as processing to prevent duplicate actions
    this.processingCalls.add(callKitUUID);
    try {
      // End the call in CallKit and hang up the WebRTC call
      await callkit_1.default.endCall(callKitUUID);
      call.hangup();
      // Clean up the mappings
      this.cleanupCall(callKitUUID);
      return true;
    } catch (error) {
      console.error('CallKitCoordinator: Error ending call from UI', error);
      call.hangup(); // Ensure WebRTC call is ended
      return false;
    } finally {
      this.processingCalls.delete(callKitUUID);
    }
  }
  /**
   * Handle CallKit answer action (triggered by CallKit)
   */
  async handleCallKitAnswer(callKitUUID, event) {
    if (this.processingCalls.has(callKitUUID)) {
      console.log('CallKitCoordinator: Answer action already being processed, skipping duplicate');
      return;
    }
    const call = this.callMap.get(callKitUUID);
    if (!call) {
      console.warn('CallKitCoordinator: No WebRTC call found for CallKit answer action', {
        callKitUUID,
        availableCallKitUUIDs: Array.from(this.callMap.keys()),
        availableWebRTCCallIds: Array.from(this.callMap.values()).map((c) => c.callId),
      });
      console.log('CallKitCoordinator: No WebRTC call found, handling as push notification');
      await this.handlePushNotificationAnswer(callKitUUID, event);
      return;
    }
    console.log('CallKitCoordinator: Processing CallKit answer action', {
      callKitUUID,
      webrtcCallId: call.callId,
      direction: call.direction,
      currentState: call.state,
    });
    if (call.state === 'active') {
      console.log('CallKitCoordinator: Call already active, skipping duplicate answer action');
      return;
    }
    this.processingCalls.add(callKitUUID);
    try {
      if (call.direction === 'inbound') {
        const voipClient = this.getSDKClient();
        if (voipClient) {
          console.log(
            'CallKitCoordinator: Setting incoming call to CONNECTING state for CallKit answer'
          );
          voipClient.setCallConnecting(call.callId);
        }
        // Report call as connected to CallKit to trigger audio session activation
        setTimeout(async () => {
          try {
            await callkit_1.default.reportCallConnected(callKitUUID);
            console.log('CallKitCoordinator: Reported call connected to activate audio session');
            this.connectedCalls.add(callKitUUID);
          } catch (error) {
            console.error(
              'CallKitCoordinator: Error reporting call connected for audio session:',
              error
            );
          }
        }, 200);
        setTimeout(() => {
          call.answer();
        }, 500);
      } else {
        console.log('CallKitCoordinator: Outgoing call, skipping answer and CONNECTING state');
      }
    } catch (error) {
      console.error('CallKitCoordinator: Error processing CallKit answer', error);
      await callkit_1.default.reportCallEnded(callKitUUID, callkit_1.CallEndReason.Failed);
      this.cleanupCall(callKitUUID);
    } finally {
      this.processingCalls.delete(callKitUUID);
    }
  }
  /**
   * Handle CallKit end action (triggered by CallKit)
   */
  async handleCallKitEnd(callKitUUID, event) {
    this.isCallFromPush = false;
    if (this.processingCalls.has(callKitUUID)) {
      console.log('CallKitCoordinator: End action already being processed, skipping duplicate');
      return;
    }
    const call = this.callMap.get(callKitUUID);
    if (!call) {
      console.warn('CallKitCoordinator: No WebRTC call found for CallKit end action', {
        callKitUUID,
        availableCallKitUUIDs: Array.from(this.callMap.keys()),
        availableWebRTCCallIds: Array.from(this.callMap.values()).map((c) => c.callId),
      });
      console.log(
        'CallKitCoordinator: No WebRTC call found, handling as push notification rejection'
      );
      await this.handlePushNotificationReject(callKitUUID, event);
      this.cleanupCall(callKitUUID);
      return;
    }
    console.log('CallKitCoordinator: Processing CallKit end action', {
      callKitUUID,
      webrtcCallId: call.callId,
    });
    this.processingCalls.add(callKitUUID);
    try {
      call.hangup();
    } catch (error) {
      console.error('CallKitCoordinator: Error hanging up WebRTC call', error);
    } finally {
      this.processingCalls.delete(callKitUUID);
      this.cleanupCall(callKitUUID);
      // Check if app is in background and no more calls - disconnect client
      await this.checkBackgroundDisconnection();
    }
  }
  /**
   * Handle CallKit start action (triggered by CallKit for outgoing calls)
   */
  async handleCallKitStart(callKitUUID) {
    const call = this.callMap.get(callKitUUID);
    if (!call) {
      console.warn(
        'CallKitCoordinator: No WebRTC call found for CallKit start action',
        callKitUUID
      );
      return;
    }
    console.log('CallKitCoordinator: Processing CallKit start action', {
      callKitUUID,
      webrtcCallId: call.callId,
    });
    // For outgoing calls, the WebRTC call should already be initiated
    // We just need to report when it connects
  }
  /**
   * Handle CallKit push received event
   * This allows us to coordinate between the push notification and any subsequent WebRTC calls
   */
  async handleCallKitPushReceived(callKitUUID, event) {
    if (this.isCallFromPush) {
      this.isCallFromPush = false;
      console.log('CallKitCoordinator: Ignoring push received event (already processed)');
      return;
    }
    console.log('CallKitCoordinator: Processing push received event', {
      callKitUUID,
      source: event?.callData?.source,
    });
    this.isCallFromPush = true;
    console.log('CallKitCoordinator: Processing push received event', {
      callKitUUID,
      source: event?.callData?.source,
      isCallFromPush: this.isCallFromPush,
    });
    try {
      // Get VoIP client instance
      const voipClient = this.getSDKClient();
      if (!voipClient) {
        console.error('CallKitCoordinator: VoIP client not available');
        return;
      }
      // Retrieve pending push data from VoIP bridge
      const pendingPushJson = await voice_pn_bridge_1.VoicePnBridge.getPendingVoipPush();
      if (!pendingPushJson) {
        console.warn('CallKitCoordinator: No pending push data found');
        return;
      }
      const pendingPush = JSON.parse(pendingPushJson);
      const realPushData = pendingPush?.payload;
      if (!realPushData?.metadata) {
        console.warn('CallKitCoordinator: Invalid push data structure');
        return;
      }
      // Prepare push metadata with CallKit flag
      const enhancedMetadata = {
        ...realPushData.metadata,
        from_callkit: true,
      };
      // Check if auto-answer is set and add from_notification flag
      const shouldAddFromNotification = this.shouldAutoAnswerNextCall;
      let pushData;
      if (shouldAddFromNotification) {
        pushData = {
          metadata: enhancedMetadata,
          from_notification: true,
          action: 'answer',
        };
        voipClient.queueAnswerFromCallKit();
      } else {
        pushData = {
          metadata: enhancedMetadata,
        };
      }
      // Process the push notification
      await voipClient.handlePushNotification(pushData);
      console.log('CallKitCoordinator: Push notification processed successfully');
    } catch (error) {
      console.error('CallKitCoordinator: Error processing push received event:', error);
    }
  }
  /**
   * Handle push notification answer - when user answers from CallKit but we don't have a WebRTC call yet
   * This is the iOS equivalent of the Android FCM handler
   */
  async handlePushNotificationAnswer(callKitUUID, event) {
    try {
      console.log(
        'CallKitCoordinator: Handling push notification answer for CallKit UUID:',
        callKitUUID
      );
      if (react_native_1.Platform.OS === 'ios') {
        console.log('CallKitCoordinator: Processing iOS push notification answer');
        // Set auto-answer flag so when the WebRTC call comes in, it will be answered automatically
        this.shouldAutoAnswerNextCall = true;
        console.log('CallKitCoordinator: ✅ Set auto-answer flag for next incoming call');
        // Get VoIP client and trigger reconnection
        const voipClient = this.getSDKClient();
        if (!voipClient) {
          console.error(
            'CallKitCoordinator: ❌ No VoIP client available - cannot reconnect for push notification'
          );
          await callkit_1.default.reportCallEnded(callKitUUID, callkit_1.CallEndReason.Failed);
          this.cleanupCall(callKitUUID);
          return;
        }
        // Get the real push data that was stored by the VoIP push handler
        console.log('CallKitCoordinator: 🔍 Getting real push data from VoicePnBridge...');
        let realPushData = null;
        try {
          const pendingPushJson = await voice_pn_bridge_1.VoicePnBridge.getPendingVoipPush();
          if (pendingPushJson) {
            const pendingPush = JSON.parse(pendingPushJson);
            if (pendingPush && pendingPush.payload) {
              console.log('CallKitCoordinator: ✅ Found real push data');
              realPushData = pendingPush.payload;
            }
          }
        } catch (error) {
          console.warn('CallKitCoordinator: Could not get real push data:', error);
        }
        // Create push notification payload - use real data if available, fallback to placeholder
        const pushAction = 'incoming_call';
        let pushMetadata;
        if (realPushData && realPushData.metadata) {
          // Use the real push metadata
          console.log('CallKitCoordinator: 🎯 Using REAL push metadata for immediate handling');
          pushMetadata = JSON.stringify({
            ...realPushData.metadata,
            from_callkit: true, // Add flag to indicate this was answered via CallKit
          });
        } else {
          // Fallback to placeholder (this should rarely happen)
          console.warn('CallKitCoordinator: ⚠️ No real push data found, using placeholder');
          pushMetadata = JSON.stringify({
            call_id: callKitUUID,
            caller_name: 'Incoming Call',
            caller_number: 'Unknown',
            voice_sdk_id: 'unknown',
            sent_time: new Date().toISOString(),
            from_callkit: true,
          });
        }
        // Set the pending push action to be handled when app comes to foreground
        await voice_pn_bridge_1.VoicePnBridge.setPendingPushAction(pushAction, pushMetadata);
        console.log('CallKitCoordinator: ✅ Set pending push action');
        return;
      }
      // For other platforms (shouldn't happen on iOS)
      console.error('CallKitCoordinator: ❌ Unsupported platform for push notification handling');
      await callkit_1.default.reportCallEnded(callKitUUID, callkit_1.CallEndReason.Failed);
    } catch (error) {
      console.error('CallKitCoordinator: ❌ Error handling push notification answer:', error);
      // Report the call as failed to CallKit
      await callkit_1.default.reportCallEnded(callKitUUID, callkit_1.CallEndReason.Failed);
      this.cleanupCall(callKitUUID);
    }
  }
  /**
   * Handle push notification reject - when user rejects from CallKit but we don't have a WebRTC call yet
   * This is the iOS equivalent of the Android FCM handler reject
   */
  async handlePushNotificationReject(callKitUUID, event) {
    try {
      console.log(
        'CallKitCoordinator: Handling push notification rejection for CallKit UUID:',
        callKitUUID
      );
      if (react_native_1.Platform.OS === 'ios') {
        console.log('CallKitCoordinator: Processing iOS push notification rejection');
        this.voipClient.queueEndFromCallKit();
        // Clean up push notification state
        await this.cleanupPushNotificationState();
        console.log('CallKitCoordinator: 🎯 Push notification rejection handling complete');
        return;
      }
      // For other platforms (shouldn't happen on iOS)
      console.error(
        'CallKitCoordinator: ❌ Unsupported platform for push notification rejection handling'
      );
    } catch (error) {
      console.error('CallKitCoordinator: ❌ Error handling push notification rejection:', error);
    }
  }
  /**
   * Set up listeners for WebRTC call state changes
   */
  setupWebRTCCallListeners(call, callKitUUID) {
    const handleStateChange = async (call, state) => {
      console.log('CallKitCoordinator: WebRTC call state changed', {
        callKitUUID,
        webrtcCallId: call.callId,
        state,
      });
      switch (state) {
        case 'active':
          // When WebRTC call becomes active, just report as connected
          // (CallKit call was already answered in answerCallFromUI)
          if (!this.connectedCalls.has(callKitUUID)) {
            console.log('CallKitCoordinator: WebRTC call active - reporting connected to CallKit');
            try {
              // Report as connected (CallKit call already answered in UI flow)
              await callkit_1.default.reportCallConnected(callKitUUID);
              console.log(
                'CallKitCoordinator: Call reported as connected to CallKit ',
                callKitUUID
              );
              this.connectedCalls.add(callKitUUID);
            } catch (error) {
              console.error('CallKitCoordinator: Error reporting call connected:', error);
            }
          }
          break;
        case 'ended':
        case 'failed':
          // Report call ended to CallKit (if not already ended)
          if (!this.endedCalls.has(callKitUUID)) {
            console.log('CallKitCoordinator: Reporting call ended to CallKit');
            const reason =
              state === 'failed'
                ? callkit_1.CallEndReason.Failed
                : callkit_1.CallEndReason.RemoteEnded;
            await callkit_1.default.reportCallEnded(callKitUUID, reason);
            this.endedCalls.add(callKitUUID);
          }
          // Clean up the call mapping
          this.cleanupCall(callKitUUID);
          break;
        case 'ringing':
          // For outgoing calls, we might want to update CallKit with additional info
          // For incoming calls, CallKit already knows about the call
          break;
      }
    };
    call.on('telnyx.call.state', handleStateChange);
    // Store the listener cleanup function
    call._callKitStateListener = () => {
      call.removeListener('telnyx.call.state', handleStateChange);
    };
  }
  /**
   * Clean up call mappings and listeners
   */
  cleanupCall(callKitUUID) {
    // Remove from all tracking sets
    this.processingCalls.delete(callKitUUID);
    this.endedCalls.delete(callKitUUID);
    this.connectedCalls.delete(callKitUUID);
    // Get the call before removing it
    const call = this.callMap.get(callKitUUID);
    // Clean up state listeners
    if (call && call._callKitStateListener) {
      call._callKitStateListener();
      delete call._callKitStateListener;
    }
    // Remove from mapping
    this.callMap.delete(callKitUUID);
    if (call) {
      // Clean up the stored UUID on the call
      delete call._callKitUUID;
    }
    // Reset flags if no more active calls
    if (this.callMap.size === 0) {
      this.resetFlags();
    }
    // Clear VoIP push data now that the call is done
    if (react_native_1.Platform.OS === 'ios') {
      voice_pn_bridge_1.VoicePnBridge.clearPendingVoipPush().catch((error) => {
        console.warn('CallKitCoordinator: Error clearing VoIP push data on call cleanup:', error);
      });
      console.log('CallKitCoordinator: ✅ Cleared VoIP push data after call ended');
    }
  }
  /**
   * Get CallKit UUID for a WebRTC call
   */
  getCallKitUUID(call) {
    // First check if the call has the UUID stored on it
    const storedUUID = call._callKitUUID;
    if (storedUUID) {
      return storedUUID;
    }
    // Search through all call mappings
    for (const [uuid, mappedCall] of this.callMap.entries()) {
      if (mappedCall.callId === call.callId) {
        // Store UUID on the call for faster future lookups
        call._callKitUUID = uuid;
        return uuid;
      }
    }
    return null;
  }
  /**
   * Get WebRTC call for a CallKit UUID
   */
  getWebRTCCall(callKitUUID) {
    return this.callMap.get(callKitUUID) || null;
  }
  /**
   * Link an existing CallKit call (from push notification) with a WebRTC call
   * This should be called when a WebRTC call arrives that corresponds to an existing CallKit call
   */
  linkExistingCallKitCall(call, callKitUUID) {
    console.log('CallKitCoordinator: Linking existing CallKit call with WebRTC call', {
      callKitUUID,
      webrtcCallId: call.callId,
    });
    // Store the mappings
    this.callMap.set(callKitUUID, call);
    // Store UUID on the call for quick access
    call._callKitUUID = callKitUUID;
    // Set up state listeners
    this.setupWebRTCCallListeners(call, callKitUUID);
  }
  /**
   * Set the VoIP client reference for triggering reconnection
   */
  setVoipClient(voipClient) {
    this.voipClient = voipClient;
  }
  /**
   * Helper method to clean up push notification state
   */
  async cleanupPushNotificationState() {
    console.log('CallKitCoordinator: ✅ Cleared auto-answer flag');
    this.shouldAutoAnswerNextCall = false;
  }
  /**
   * Get reference to the SDK client (for queuing actions when call doesn't exist yet)
   */
  getSDKClient() {
    return this.voipClient;
  }
  /**
   * Check if app is in background and disconnect client if no active calls
   */
  async checkBackgroundDisconnection() {
    const currentAppState = react_native_1.AppState.currentState;
    // Only disconnect if app is in background/inactive and no active calls
    if (
      (currentAppState === 'background' || currentAppState === 'inactive') &&
      this.callMap.size === 0 &&
      this.voipClient
    ) {
      console.log(
        'CallKitCoordinator: App in background with no active calls - disconnecting client'
      );
      try {
        await this.voipClient.logout();
        console.log('CallKitCoordinator: Successfully disconnected client on background');
      } catch (error) {
        console.error('CallKitCoordinator: Error disconnecting client on background:', error);
      }
    } else {
      console.log('CallKitCoordinator: Skipping background disconnection', {
        appState: currentAppState,
        activeCalls: this.callMap.size,
        hasVoipClient: !!this.voipClient,
      });
    }
  }
  /**
   * Reset only flags (keeping active call mappings intact)
   */
  resetFlags() {
    console.log('CallKitCoordinator: Resetting coordinator flags');
    // Reset push notification flag
    this.isCallFromPush = false;
    // Reset auto-answer flag
    this.shouldAutoAnswerNextCall = false;
    console.log('CallKitCoordinator: ✅ Coordinator flags reset');
  }
  /**
   * Check if there are any calls currently being processed by CallKit
   * This helps prevent premature flag resets during CallKit operations
   */
  hasProcessingCalls() {
    return this.processingCalls.size > 0;
  }
  /**
   * Check if there's currently a call from push notification being processed
   * This helps prevent disconnection during push call handling
   */
  getIsCallFromPush() {
    return this.isCallFromPush;
  }
  /**
   * Check if CallKit is available and coordinator is active
   */
  isAvailable() {
    return react_native_1.Platform.OS === 'ios' && callkit_1.default.isAvailable();
  }
}
CallKitCoordinator.instance = null;
// Export singleton instance
exports.callKitCoordinator = CallKitCoordinator.getInstance();
exports.default = exports.callKitCoordinator;
