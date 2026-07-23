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
    // Tracks action+UUID pairs so an end action is not dropped merely because
    // an answer or held action for the same call is still completing.
    this.processingCalls = new Set();
    // Tracks calls that have already been ended in CallKit to prevent duplicate reports
    this.endedCalls = new Set();
    // Tracks calls that have already been reported as connected to prevent duplicate reports
    this.connectedCalls = new Set();
    this.isCallFromPush = false;
    this.pendingPushCallUUIDs = new Set();
    this.selectedCallKitUUID = null;
    this.restoreHeldCallPromise = null;
    this.pendingSwap = null;
    this.pendingHeldRequests = new Map();
    // Push answers are keyed so answering B cannot auto-answer another invite.
    this.autoAnswerCallUUIDs = new Set();
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
    callkit_1.default.onHeldCall((event) => {
      void this.handleCallKitHeld(event.callUUID, Boolean(event.isOnHold));
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
    const existingCallKitUUID = this.getCallKitUUID(call);
    if (existingCallKitUUID) {
      this.linkExistingCallKitCall(call, existingCallKitUUID);
      return existingCallKitUUID;
    }
    // Socket-only incoming calls use their signaling ID as the app-facing ID.
    const callKitUUID = this.normalizeUUID(call.callId);
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
          call._callKitUUID = callKitUUID;
          return callKitUUID;
        }
        await this.rejectUnregisteredIncomingCall(callKitUUID, call);
      }
      return null;
    } catch (error) {
      console.error('CallKitCoordinator: Failed to report incoming call', error);
      await this.rejectUnregisteredIncomingCall(callKitUUID, call);
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
    const callKitUUID = this.normalizeUUID(call.callId);
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
    if (!callKitUUID) {
      console.warn('CallKitCoordinator: Cannot answer call - no CallKit UUID found');
      return false;
    }
    console.log(
      'CallKitCoordinator: Answering call from UI using CallKit answer simulation',
      callKitUUID
    );
    const isRegistered = await callkit_1.default.isCallRegistered(callKitUUID);
    if (!isRegistered) {
      console.warn(
        'CallKitCoordinator: Suppressing answer because CallKit rejected or removed the call',
        { callKitUUID }
      );
      await this.rejectUnregisteredIncomingCall(callKitUUID, call);
      return false;
    }
    // Mark as processing to prevent duplicate actions
    const processingKey = this.actionKey('answer', callKitUUID);
    this.processingCalls.add(processingKey);
    try {
      // Simulate the CallKit answer action, which will trigger our answer handler
      const success = await callkit_1.default.answerCall(callKitUUID);
      if (success) {
        if (call.direction === 'inbound' && call.state !== 'active') {
          await call.answer();
        }
        this.selectCall(call);
        this.pendingPushCallUUIDs.delete(callKitUUID);
        this.isCallFromPush = this.pendingPushCallUUIDs.size > 0;
        console.log('CallKitCoordinator: CallKit answer success');
      }
      return success;
    } catch (error) {
      console.error('CallKitCoordinator: Error answering call from UI', error);
      await callkit_1.default.reportCallEnded(callKitUUID, callkit_1.CallEndReason.Failed);
      this.cleanupCall(callKitUUID);
      return false;
    } finally {
      this.processingCalls.delete(processingKey);
    }
  }
  /**
   * Change held state from app UI through CallKit, then wait for signaling and
   * the corresponding CXSetHeldCallAction to complete.
   */
  async setHeldFromUI(call, isOnHold) {
    const callKitUUID = this.getCallKitUUID(call);
    if (!callKitUUID) {
      console.warn('CallKitCoordinator: Cannot change held state without a CallKit UUID');
      return false;
    }
    const desiredState = isOnHold ? 'held' : 'active';
    if (call.state === desiredState) {
      if (!isOnHold) {
        this.selectCall(call);
      }
      return true;
    }
    const requiredState = isOnHold ? 'active' : 'held';
    if (call.state !== requiredState || this.pendingSwap) {
      console.warn('CallKitCoordinator: Cannot change held state in current state', {
        callKitUUID,
        currentState: call.state,
        desiredState,
        hasPendingSwap: Boolean(this.pendingSwap),
      });
      return false;
    }
    const requestKey = this.actionKey(isOnHold ? 'hold' : 'unhold', callKitUUID);
    if (this.pendingHeldRequests.has(requestKey) || this.processingCalls.has(requestKey)) {
      return false;
    }
    let resolveRequest;
    const completion = new Promise((resolve) => {
      resolveRequest = resolve;
    });
    const timeout = setTimeout(() => {
      console.error('CallKitCoordinator: Held-state request timed out', {
        callKitUUID,
        isOnHold,
      });
      this.finishPendingHeldRequest(requestKey, false);
    }, 12000);
    this.pendingHeldRequests.set(requestKey, {
      resolve: resolveRequest,
      timeout,
    });
    const accepted = await callkit_1.default.setCallHeld(callKitUUID, isOnHold);
    if (!accepted) {
      this.finishPendingHeldRequest(requestKey, false);
    }
    return completion;
  }
  /**
   * Swap an active call with a held call through one CallKit transaction.
   * The promise settles only after both corresponding WebRTC state changes
   * have completed and their CallKit actions have been fulfilled.
   */
  async swapCallsFromUI(activeCall, heldCall) {
    const activeCallKitUUID = this.getCallKitUUID(activeCall);
    const heldCallKitUUID = this.getCallKitUUID(heldCall);
    if (!activeCallKitUUID || !heldCallKitUUID || activeCallKitUUID === heldCallKitUUID) {
      console.warn('CallKitCoordinator: Cannot swap calls without two distinct CallKit UUIDs');
      return false;
    }
    if (activeCall.state !== 'active' || heldCall.state !== 'held') {
      console.warn('CallKitCoordinator: Cannot swap calls in their current states', {
        activeCallState: activeCall.state,
        heldCallState: heldCall.state,
      });
      return false;
    }
    if (this.pendingSwap) {
      console.warn('CallKitCoordinator: A call swap is already in progress');
      return false;
    }
    let resolveSwap;
    const swapCompletion = new Promise((resolve) => {
      resolveSwap = resolve;
    });
    this.pendingSwap = this.createPendingSwap({
      mode: 'swap',
      originalActiveCallKitUUID: activeCallKitUUID,
      originalHeldCallKitUUID: heldCallKitUUID,
      activeCallKitUUID,
      heldCallKitUUID,
      resolve: resolveSwap,
    });
    const accepted = await callkit_1.default.swapCalls(activeCallKitUUID, heldCallKitUUID);
    if (!accepted) {
      await this.beginSwapRollback(this.pendingSwap);
    }
    return swapCompletion;
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
    console.log('CallKitCoordinator: Requesting CallKit end action from app UI', callKitUUID);
    try {
      // Let the resulting CXEndCallAction drive signaling, cleanup and survivor
      // restoration. Marking the call ended here would suppress that event.
      const endCallSuccess = await callkit_1.default.endCall(callKitUUID);
      if (endCallSuccess) {
        return true;
      }
      const shouldRestoreRemainingCall = this.isSelectedCall(call);
      this.endedCalls.add(callKitUUID);
      await callkit_1.default.reportCallEnded(callKitUUID, callkit_1.CallEndReason.RemoteEnded);
      this.pendingPushCallUUIDs.delete(callKitUUID);
      this.isCallFromPush = this.pendingPushCallUUIDs.size > 0;
      call.hangup();
      this.cleanupCall(callKitUUID);
      if (shouldRestoreRemainingCall) {
        await this.restoreRemainingHeldCall();
      }
      return false;
    } catch (error) {
      console.error('CallKitCoordinator: Error ending call from UI', error);
      this.pendingPushCallUUIDs.delete(callKitUUID);
      this.isCallFromPush = this.pendingPushCallUUIDs.size > 0;
      call.hangup();
      this.cleanupCall(callKitUUID);
      await this.restoreRemainingHeldCall();
      return false;
    }
  }
  /**
   * Handle CallKit answer action (triggered by CallKit)
   */
  async handleCallKitAnswer(callKitUUID, event) {
    callKitUUID = this.normalizeUUID(callKitUUID);
    const processingKey = this.actionKey('answer', callKitUUID);
    if (this.processingCalls.has(processingKey)) {
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
      this.selectCall(call);
      return;
    }
    this.processingCalls.add(processingKey);
    try {
      if (call.direction === 'inbound') {
        const voipClient = this.getSDKClient();
        if (voipClient) {
          console.log(
            'CallKitCoordinator: Setting incoming call to CONNECTING state for CallKit answer'
          );
          voipClient.setCallConnecting(call.callId);
        }
        await call.answer();
        this.selectCall(call);
      } else {
        console.log('CallKitCoordinator: Outgoing call, skipping answer and CONNECTING state');
      }
      // Clear push data now that answer action is fulfilled
      try {
        await voice_pn_bridge_1.VoicePnBridge.clearPendingVoipPush();
        console.log('CallKitCoordinator: Cleared pending VoIP push after answer fulfilled');
      } catch (clearErr) {
        console.error('CallKitCoordinator: Error clearing push data after answer:', clearErr);
      }
    } catch (error) {
      console.error('CallKitCoordinator: Error processing CallKit answer', error);
      await callkit_1.default.reportCallEnded(callKitUUID, callkit_1.CallEndReason.Failed);
      this.cleanupCall(callKitUUID);
      // Clear push data even on error to prevent stale state
      try {
        await voice_pn_bridge_1.VoicePnBridge.clearPendingVoipPush();
      } catch (_) {}
    } finally {
      this.processingCalls.delete(processingKey);
    }
  }
  /** Handle a UUID-targeted CallKit hold or resume action. */
  async handleCallKitHeld(callKitUUID, isOnHold) {
    callKitUUID = this.normalizeUUID(callKitUUID);
    const processingKey = this.actionKey(isOnHold ? 'hold' : 'unhold', callKitUUID);
    if (this.processingCalls.has(processingKey)) {
      return;
    }
    const call = this.callMap.get(callKitUUID);
    if (!call) {
      console.warn('CallKitCoordinator: No WebRTC call found for held action', { callKitUUID });
      await callkit_1.default.completeHeldCallAction(callKitUUID, false);
      this.finishPendingHeldRequest(processingKey, false);
      return;
    }
    this.processingCalls.add(processingKey);
    try {
      if (isOnHold && call.state !== 'held') {
        await call.hold();
      } else if (!isOnHold && call.state !== 'active') {
        await call.unhold();
      }
      if (!isOnHold) {
        this.selectCall(call);
      }
      const completed = await callkit_1.default.completeHeldCallAction(callKitUUID, true);
      this.recordPendingSwapAction(callKitUUID, isOnHold, completed);
      this.finishPendingHeldRequest(processingKey, completed);
    } catch (error) {
      console.error('CallKitCoordinator: Held action failed', { callKitUUID, isOnHold, error });
      await callkit_1.default.completeHeldCallAction(callKitUUID, false);
      this.recordPendingSwapAction(callKitUUID, isOnHold, false);
      this.finishPendingHeldRequest(processingKey, false);
    } finally {
      this.processingCalls.delete(processingKey);
    }
  }
  /**
   * Handle CallKit end action (triggered by CallKit)
   */
  async handleCallKitEnd(callKitUUID, event) {
    callKitUUID = this.normalizeUUID(callKitUUID);
    const wasPendingPush = this.pendingPushCallUUIDs.delete(callKitUUID);
    this.isCallFromPush = this.pendingPushCallUUIDs.size > 0;
    const processingKey = this.actionKey('end', callKitUUID);
    if (this.processingCalls.has(processingKey)) {
      console.log('CallKitCoordinator: End action already being processed, skipping duplicate');
      return;
    }
    if (this.endedCalls.has(callKitUUID)) {
      console.log('CallKitCoordinator: Call already ended, skipping duplicate end action');
      return;
    }
    // Mark as ended immediately to prevent any duplicate processing
    this.endedCalls.add(callKitUUID);
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
    const shouldRestoreRemainingCall = this.isSelectedCall(call);
    this.processingCalls.add(processingKey);
    try {
      call.hangup();
    } catch (error) {
      console.error('CallKitCoordinator: Error hanging up WebRTC call', error);
    } finally {
      this.processingCalls.delete(processingKey);
      this.cleanupCall(callKitUUID);
      if (shouldRestoreRemainingCall) {
        await this.restoreRemainingHeldCall();
      }
      if (wasPendingPush) {
        await voice_pn_bridge_1.VoicePnBridge.clearPendingVoipPush().catch((error) => {
          console.warn('CallKitCoordinator: Failed to clear ended call push data', error);
        });
      }
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
    callKitUUID = this.normalizeUUID(callKitUUID);
    if (this.pendingPushCallUUIDs.has(callKitUUID)) {
      console.log('CallKitCoordinator: Ignoring duplicate push UUID', callKitUUID);
      return;
    }
    const isRegistered = await callkit_1.default.isCallRegistered(callKitUUID);
    if (!isRegistered) {
      console.warn(
        'CallKitCoordinator: Ignoring push because its CallKit registration was rejected',
        { callKitUUID }
      );
      this.getSDKClient()?.queueEndFromCallKit(callKitUUID);
      await this.clearMatchingPendingVoipPush(callKitUUID);
      return;
    }
    console.log('CallKitCoordinator: Processing push received event', {
      callKitUUID,
      source: event?.callData?.source,
    });
    this.isCallFromPush = true;
    this.pendingPushCallUUIDs.add(callKitUUID);
    console.log('CallKitCoordinator: Processing push received event', {
      callKitUUID,
      source: event?.callData?.source,
      isCallFromPush: this.isCallFromPush,
    });
    try {
      // Get VoIP client instance
      const voipClient = this.getSDKClient();
      if (!voipClient) {
        throw new Error('CallKitCoordinator: VoIP client not available');
      }
      // Retrieve pending push data from VoIP bridge
      const pendingPushJson = await voice_pn_bridge_1.VoicePnBridge.getPendingVoipPush();
      if (!pendingPushJson) {
        throw new Error('CallKitCoordinator: No pending push data found');
      }
      const pendingPush = JSON.parse(pendingPushJson);
      const realPushData = pendingPush?.payload;
      if (!realPushData?.metadata) {
        throw new Error('CallKitCoordinator: Invalid push data structure');
      }
      // Prepare push metadata with CallKit flag
      const enhancedMetadata = {
        ...realPushData.metadata,
        from_callkit: true,
      };
      // This app-facing UUID is attached to the next inbound Call while the
      // socket INVITE retains its own signaling callID.
      voipClient.setPushNotificationCallKitUUID(callKitUUID);
      // A pre-INVITE CallKit answer is represented only by the UUID-keyed
      // pending action. Do not also add legacy notification flags.
      const shouldAddFromNotification = this.autoAnswerCallUUIDs.has(callKitUUID);
      let pushData;
      if (shouldAddFromNotification) {
        pushData = {
          metadata: enhancedMetadata,
        };
        voipClient.queueAnswerFromCallKit(callKitUUID);
        this.autoAnswerCallUUIDs.delete(callKitUUID);
      } else {
        pushData = {
          metadata: enhancedMetadata,
        };
      }
      // Process the push notification
      await voipClient.handlePushNotification(pushData);
      console.log('CallKitCoordinator: Push notification processed successfully');
    } catch (error) {
      this.pendingPushCallUUIDs.delete(callKitUUID);
      this.isCallFromPush = this.pendingPushCallUUIDs.size > 0;
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
        this.autoAnswerCallUUIDs.add(callKitUUID);
        console.log('CallKitCoordinator: Set UUID-targeted auto-answer', callKitUUID);
        // Try to get VoIP client - it may not be wired yet if user answered
        // from CallKit before React Native finished initializing
        const voipClient = this.getSDKClient();
        if (!voipClient) {
          // voipClient not ready yet - DON'T fail the call.
          // The UUID-targeted auto-answer is already stored above.
          // checkForInitialPushNotification() will run after setVoipClient()
          // and will find the push data still intact, call handleCallKitPushReceived()
          // which queues the matching auto-answer.
          return;
        }
        // Queue one UUID-targeted answer. If the push is already being
        // processed, its eventual INVITE will consume this action. Otherwise
        // process the still-persisted VoIP payload now.
        voipClient.queueAnswerFromCallKit(callKitUUID);
        if (this.pendingPushCallUUIDs.has(callKitUUID)) {
          this.autoAnswerCallUUIDs.delete(callKitUUID);
          return;
        }
        await this.handleCallKitPushReceived(callKitUUID, event);
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
        this.getSDKClient()?.queueEndFromCallKit(callKitUUID);
        // Clean up push notification state
        await this.cleanupPushNotificationState();
        // Clear push data now that rejection is handled
        try {
          await voice_pn_bridge_1.VoicePnBridge.clearPendingVoipPush();
          console.log('CallKitCoordinator: Cleared pending VoIP push after rejection handled');
        } catch (_) {}
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
          this.selectCall(call);
          this.pendingPushCallUUIDs.delete(callKitUUID);
          this.autoAnswerCallUUIDs.delete(callKitUUID);
          this.isCallFromPush = this.pendingPushCallUUIDs.size > 0;
          // When WebRTC call becomes active, just report as connected
          // (CallKit call was already answered in answerCallFromUI)
          if (!this.connectedCalls.has(callKitUUID)) {
            console.log('CallKitCoordinator: WebRTC call active - reporting connected to CallKit');
            try {
              await callkit_1.default.reportCallConnected(callKitUUID);
            } catch (error) {
              console.error('CallKitCoordinator: Error reporting call connected:', error);
            }
            this.connectedCalls.add(callKitUUID);
          }
          break;
        case 'ended':
        case 'failed': {
          const shouldRestoreRemainingCall =
            this.selectedCallKitUUID === callKitUUID &&
            !this.processingCalls.has(this.actionKey('end', callKitUUID));
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
          if (shouldRestoreRemainingCall) {
            await this.restoreRemainingHeldCall();
          }
          break;
        }
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
    callKitUUID = this.normalizeUUID(callKitUUID);
    if (
      this.pendingSwap?.activeCallKitUUID === callKitUUID ||
      this.pendingSwap?.heldCallKitUUID === callKitUUID
    ) {
      this.finishPendingSwap(false);
    }
    for (const processingKey of this.processingCalls) {
      if (processingKey.endsWith(`:${callKitUUID}`)) {
        this.processingCalls.delete(processingKey);
      }
    }
    for (const requestKey of this.pendingHeldRequests.keys()) {
      if (requestKey.endsWith(`:${callKitUUID}`)) {
        this.finishPendingHeldRequest(requestKey, false);
      }
    }
    this.connectedCalls.delete(callKitUUID);
    this.pendingPushCallUUIDs.delete(callKitUUID);
    this.autoAnswerCallUUIDs.delete(callKitUUID);
    // Get the call before removing it
    const call = this.callMap.get(callKitUUID);
    // Clean up state listeners
    if (call && call._callKitStateListener) {
      call._callKitStateListener();
      delete call._callKitStateListener;
    }
    // Remove from mapping
    this.callMap.delete(callKitUUID);
    if (this.selectedCallKitUUID === callKitUUID) {
      this.selectedCallKitUUID = null;
    }
    // Reset flags if no more active calls
    if (this.callMap.size === 0) {
      this.resetFlags();
    }
    this.isCallFromPush = this.pendingPushCallUUIDs.size > 0;
  }
  /**
   * Get CallKit UUID for a WebRTC call
   */
  getCallKitUUID(call) {
    // First check if the call has the UUID stored on it
    const storedUUID = call._callKitUUID;
    if (storedUUID) {
      return this.normalizeUUID(storedUUID);
    }
    // Search through all call mappings
    for (const [uuid, mappedCall] of this.callMap.entries()) {
      if (mappedCall.callId === call.callId) {
        // Store UUID on the call for faster future lookups
        if (!call._callKitUUID) {
          call._callKitUUID = uuid;
        }
        return this.normalizeUUID(uuid);
      }
    }
    return null;
  }
  /**
   * Get WebRTC call for a CallKit UUID
   */
  getWebRTCCall(callKitUUID) {
    return this.callMap.get(this.normalizeUUID(callKitUUID)) || null;
  }
  /**
   * Link an existing CallKit call (from push notification) with a WebRTC call
   * This should be called when a WebRTC call arrives that corresponds to an existing CallKit call
   */
  linkExistingCallKitCall(call, callKitUUID) {
    callKitUUID = this.normalizeUUID(callKitUUID);
    console.log('CallKitCoordinator: Linking existing CallKit call with WebRTC call', {
      callKitUUID,
      webrtcCallId: call.callId,
    });
    // Store the mappings
    this.callMap.set(callKitUUID, call);
    // Push-created calls already carry a durable, non-configurable UUID.
    if (!call._callKitUUID) {
      call._callKitUUID = callKitUUID;
    }
    // Set up state listeners
    if (!call._callKitStateListener) {
      this.setupWebRTCCallListeners(call, callKitUUID);
    }
  }
  /**
   * Set the VoIP client reference for triggering reconnection.
   *
   * @deprecated No longer needed — TelnyxVoiceApp now auto-wires the voipClient
   * on mount. Kept for backwards compatibility.
   */
  setVoipClient(voipClient) {
    this.voipClient = voipClient;
  }
  /**
   * Helper method to clean up push notification state
   */
  async cleanupPushNotificationState() {
    console.log('CallKitCoordinator: Push notification state cleaned up');
  }
  async rejectUnregisteredIncomingCall(callKitUUID, call) {
    callKitUUID = this.normalizeUUID(callKitUUID);
    console.warn('CallKitCoordinator: Cleaning up unregistered incoming call', {
      callKitUUID,
      webrtcCallId: call.callId,
    });
    this.cleanupCall(callKitUUID);
    try {
      await call.hangup();
    } catch (error) {
      console.warn('CallKitCoordinator: Failed to end unregistered signaling call', error);
    }
    await this.clearMatchingPendingVoipPush(callKitUUID);
  }
  async clearMatchingPendingVoipPush(callKitUUID) {
    try {
      const pendingPushJson = await voice_pn_bridge_1.VoicePnBridge.getPendingVoipPush();
      if (!pendingPushJson) {
        return;
      }
      const pendingPush = JSON.parse(pendingPushJson);
      const pendingCallId =
        pendingPush?.payload?.metadata?.call_id ??
        pendingPush?.payload?.call_id ??
        pendingPush?.metadata?.call_id ??
        pendingPush?.call_id;
      if (
        typeof pendingCallId === 'string' &&
        this.normalizeUUID(pendingCallId) === this.normalizeUUID(callKitUUID)
      ) {
        await voice_pn_bridge_1.VoicePnBridge.clearPendingVoipPush();
      }
    } catch (error) {
      console.warn('CallKitCoordinator: Failed to clear rejected call push state', error);
    }
  }
  /**
   * Get reference to the SDK client (for queuing actions when call doesn't exist yet)
   */
  getSDKClient() {
    return this.voipClient;
  }
  normalizeUUID(callKitUUID) {
    return callKitUUID.toLowerCase();
  }
  actionKey(action, callKitUUID) {
    return `${action}:${this.normalizeUUID(callKitUUID)}`;
  }
  selectCall(call) {
    const callKitUUID = this.getCallKitUUID(call);
    const wrapperCall = this.voipClient?.findCallByTelnyxCall(call);
    if (!callKitUUID || !wrapperCall || !this.voipClient) {
      return;
    }
    this.selectedCallKitUUID = callKitUUID;
    this.voipClient.setActiveCall(wrapperCall.callId);
  }
  isSelectedCall(call) {
    const callKitUUID = this.getCallKitUUID(call);
    return callKitUUID !== null && callKitUUID === this.selectedCallKitUUID;
  }
  recordPendingSwapAction(callKitUUID, isOnHold, success) {
    const pendingSwap = this.pendingSwap;
    if (!pendingSwap || pendingSwap.mode === 'restoring') {
      return;
    }
    const isExpectedAction =
      (callKitUUID === pendingSwap.activeCallKitUUID && isOnHold) ||
      (callKitUUID === pendingSwap.heldCallKitUUID && !isOnHold);
    if (!isExpectedAction) {
      return;
    }
    pendingSwap.failed || (pendingSwap.failed = !success);
    pendingSwap.completedCallKitUUIDs.add(callKitUUID);
    if (pendingSwap.completedCallKitUUIDs.size === 2) {
      if (pendingSwap.mode === 'swap' && pendingSwap.failed) {
        void this.beginSwapRollback(pendingSwap);
      } else {
        this.finishPendingSwap(pendingSwap.mode === 'swap');
      }
    }
  }
  createPendingSwap({
    mode,
    originalActiveCallKitUUID,
    originalHeldCallKitUUID,
    activeCallKitUUID,
    heldCallKitUUID,
    resolve,
  }) {
    const pendingSwap = {
      mode,
      originalActiveCallKitUUID,
      originalHeldCallKitUUID,
      activeCallKitUUID,
      heldCallKitUUID,
      completedCallKitUUIDs: new Set(),
      failed: false,
      resolve,
      timeout: undefined,
    };
    pendingSwap.timeout = setTimeout(() => {
      if (this.pendingSwap !== pendingSwap) {
        return;
      }
      console.error(`CallKitCoordinator: Call ${mode} timed out`);
      if (mode === 'swap') {
        void this.beginSwapRollback(pendingSwap);
      } else {
        this.finishPendingSwap(false);
      }
    }, 12000);
    return pendingSwap;
  }
  async beginSwapRollback(pendingSwap) {
    if (!pendingSwap || this.pendingSwap !== pendingSwap || pendingSwap.mode !== 'swap') {
      return;
    }
    clearTimeout(pendingSwap.timeout);
    // Keep the operation installed while restoring WebRTC state so another
    // hold or swap cannot enter and have its pending promise overwritten.
    pendingSwap.mode = 'restoring';
    await this.restoreOriginalWebRTCStates(
      pendingSwap.originalActiveCallKitUUID,
      pendingSwap.originalHeldCallKitUUID
    );
    // A call may have ended while restoration was in flight, in which case
    // cleanup already resolved and removed this operation.
    if (this.pendingSwap !== pendingSwap) {
      return;
    }
    const rollback = this.createPendingSwap({
      mode: 'rollback',
      originalActiveCallKitUUID: pendingSwap.originalActiveCallKitUUID,
      originalHeldCallKitUUID: pendingSwap.originalHeldCallKitUUID,
      // A reverse swap requests the original held call to remain held and the
      // original active call to become active again.
      activeCallKitUUID: pendingSwap.originalHeldCallKitUUID,
      heldCallKitUUID: pendingSwap.originalActiveCallKitUUID,
      resolve: pendingSwap.resolve,
    });
    this.pendingSwap = rollback;
    const accepted = await callkit_1.default.swapCalls(
      rollback.activeCallKitUUID,
      rollback.heldCallKitUUID
    );
    if (!accepted && this.pendingSwap === rollback) {
      console.error('CallKitCoordinator: Compensating swap transaction was rejected');
      this.finishPendingSwap(false);
    }
  }
  async restoreOriginalWebRTCStates(activeCallKitUUID, heldCallKitUUID) {
    const originalActive = this.callMap.get(activeCallKitUUID);
    const originalHeld = this.callMap.get(heldCallKitUUID);
    try {
      if (originalHeld?.state === 'active') {
        await originalHeld.hold();
      }
      if (originalActive?.state === 'held') {
        await originalActive.unhold();
      }
      if (originalActive?.state === 'active') {
        this.selectCall(originalActive);
      }
    } catch (error) {
      console.error('CallKitCoordinator: Failed to restore WebRTC state before swap rollback', {
        activeCallKitUUID,
        heldCallKitUUID,
        error,
      });
    }
  }
  finishPendingSwap(success) {
    const pendingSwap = this.pendingSwap;
    if (!pendingSwap) {
      return;
    }
    this.pendingSwap = null;
    clearTimeout(pendingSwap.timeout);
    pendingSwap.resolve(success);
  }
  finishPendingHeldRequest(requestKey, success) {
    const request = this.pendingHeldRequests.get(requestKey);
    if (!request) {
      return;
    }
    this.pendingHeldRequests.delete(requestKey);
    clearTimeout(request.timeout);
    request.resolve(success);
  }
  async restoreRemainingHeldCall() {
    if (this.restoreHeldCallPromise) {
      return this.restoreHeldCallPromise;
    }
    this.restoreHeldCallPromise = (async () => {
      const heldEntry = Array.from(this.callMap.entries()).find(
        ([, call]) => call.state === 'held'
      );
      if (!heldEntry) {
        return;
      }
      const [callKitUUID, heldCall] = heldEntry;
      try {
        const restored = await this.setHeldFromUI(heldCall, false);
        if (!restored) {
          throw new Error('CallKit rejected survivor resume');
        }
        console.log('CallKitCoordinator: Restored remaining held call', callKitUUID);
      } catch (error) {
        console.error('CallKitCoordinator: Failed to restore remaining held call', {
          callKitUUID,
          error,
        });
      }
    })();
    try {
      await this.restoreHeldCallPromise;
    } finally {
      this.restoreHeldCallPromise = null;
    }
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
    this.isCallFromPush = this.pendingPushCallUUIDs.size > 0;
    console.log('CallKitCoordinator: ✅ Coordinator flags reset');
  }
  /**
   * Check if there are any calls currently being processed by CallKit
   * This helps prevent premature flag resets during CallKit operations
   */
  hasProcessingCalls() {
    // Also return true when isCallFromPush is set — this prevents the
    // calls$ subscription in TelnyxVoiceApp from resetting protection flags
    // (isHandlingForegroundCall, backgroundDetectorIgnore) before the WebRTC
    // call arrives during push notification handling.
    return this.processingCalls.size > 0 || this.isCallFromPush;
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
