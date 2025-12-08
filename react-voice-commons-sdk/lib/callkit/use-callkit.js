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
exports.useCallKit = useCallKit;
const react_1 = require('react');
const callkit_1 = __importStar(require('./callkit'));
function useCallKit(options = {}) {
  const { onAnswerCall, onEndCall, onStartCall } = options;
  const [activeCalls, setActiveCalls] = (0, react_1.useState)([]);
  const [isAvailable, setIsAvailable] = (0, react_1.useState)(false);
  // Use refs to store stable callback references and current state
  const onAnswerCallRef = (0, react_1.useRef)(onAnswerCall);
  const onEndCallRef = (0, react_1.useRef)(onEndCall);
  const onStartCallRef = (0, react_1.useRef)(onStartCall);
  const activeCallsRef = (0, react_1.useRef)(activeCalls);
  // Update refs when callbacks change
  (0, react_1.useEffect)(() => {
    onAnswerCallRef.current = onAnswerCall;
  }, [onAnswerCall]);
  (0, react_1.useEffect)(() => {
    onEndCallRef.current = onEndCall;
  }, [onEndCall]);
  (0, react_1.useEffect)(() => {
    onStartCallRef.current = onStartCall;
  }, [onStartCall]);
  // Update active calls ref
  (0, react_1.useEffect)(() => {
    activeCallsRef.current = activeCalls;
  }, [activeCalls]);
  (0, react_1.useEffect)(() => {
    setIsAvailable(callkit_1.default.isAvailable());
    if (!callkit_1.default.isAvailable()) {
      console.log('CallKit: Not available on this platform');
      return;
    }
    // Load existing active calls only once
    const loadActiveCalls = async () => {
      const calls = await callkit_1.default.getActiveCalls();
      setActiveCalls(
        calls.map((call) => ({
          uuid: call.uuid,
          handle: call.handle || call.caller || 'Unknown',
          displayName: call.caller || call.displayName || 'Unknown Caller',
          isActive: true,
          direction: call.direction || 'incoming',
        }))
      );
    };
    loadActiveCalls();
    // Set up event listeners using stable refs
    const unsubscribeAnswer = callkit_1.default.onAnswerCall((event) => {
      console.log('useCallKit: Call answered via CallKit', event);
      onAnswerCallRef.current?.(event.callUUID);
    });
    const unsubscribeEnd = callkit_1.default.onEndCall((event) => {
      console.log('useCallKit: Call ended via CallKit', event);
      setActiveCalls((prev) => prev.filter((call) => call.uuid !== event.callUUID));
      onEndCallRef.current?.(event.callUUID);
    });
    const unsubscribeStart = callkit_1.default.onStartCall((event) => {
      console.log('useCallKit: Call started via CallKit', event);
      onStartCallRef.current?.(event.callUUID);
    });
    return () => {
      unsubscribeAnswer();
      unsubscribeEnd();
      unsubscribeStart();
    };
  }, []); // Empty dependency array - only run once
  // Start an outgoing call
  const startOutgoingCall = (0, react_1.useCallback)(async (call, handle, displayName) => {
    if (!callkit_1.default.isAvailable()) {
      console.warn('CallKit: Not available, cannot start outgoing call');
      return null;
    }
    const callUUID = callkit_1.default.generateCallUUID();
    const callHandle = handle || call.destinationNumber || 'Unknown';
    const callDisplayName = displayName || callHandle;
    console.log('useCallKit: Starting outgoing call', {
      callUUID,
      callHandle,
      callDisplayName,
      telnyxCallId: call.callId,
    });
    const success = await callkit_1.default.startOutgoingCall(
      callUUID,
      callHandle,
      callDisplayName
    );
    if (success) {
      const newCall = {
        uuid: callUUID,
        handle: callHandle,
        displayName: callDisplayName,
        isActive: false,
        direction: 'outgoing',
      };
      setActiveCalls((prev) => [...prev, newCall]);
      // Store mapping between CallKit UUID and Telnyx call for later reference
      call._callKitUUID = callUUID;
      return callUUID;
    }
    return null;
  }, []);
  // Report an incoming call
  const reportIncomingCall = (0, react_1.useCallback)(async (call, handle, displayName) => {
    if (!callkit_1.default.isAvailable()) {
      console.warn('CallKit: Not available, cannot report incoming call');
      return null;
    }
    const callUUID = callkit_1.default.generateCallUUID();
    const callHandle = handle || call.destinationNumber || call.callId || 'Unknown';
    const callDisplayName = displayName || callHandle;
    console.log('useCallKit: Reporting incoming call', {
      callUUID,
      callHandle,
      callDisplayName,
      telnyxCallId: call.callId,
    });
    const success = await callkit_1.default.reportIncomingCall(
      callUUID,
      callHandle,
      callDisplayName
    );
    if (success) {
      const newCall = {
        uuid: callUUID,
        handle: callHandle,
        displayName: callDisplayName,
        isActive: false,
        direction: 'incoming',
      };
      setActiveCalls((prev) => [...prev, newCall]);
      // Store mapping between CallKit UUID and Telnyx call for later reference
      call._callKitUUID = callUUID;
      return callUUID;
    }
    return null;
  }, []);
  // End a call
  const endCall = (0, react_1.useCallback)(
    async (callUUID, reason = callkit_1.CallEndReason.RemoteEnded) => {
      if (!callkit_1.default.isAvailable()) {
        return false;
      }
      console.log('useCallKit: Ending call', { callUUID, reason });
      try {
        // For incoming calls, we should use reportCallEnded (which dismisses the UI)
        // For outgoing calls, we should use endCall (which sends the end request)
        // Check if this is likely an incoming call by looking at our active calls
        const activeCall = activeCallsRef.current.find((call) => call.uuid === callUUID);
        const isIncomingCall = activeCall?.direction === 'incoming';
        if (isIncomingCall) {
          await callkit_1.default.reportCallEnded(callUUID, reason);
        } else {
          await callkit_1.default.endCall(callUUID);
        }
        // Update our local state
        setActiveCalls((prev) => prev.filter((call) => call.uuid !== callUUID));
        return true;
      } catch (error) {
        console.log('useCallKit: Error ending call (may already be ended):', error);
        // Still remove from our local state even if CallKit operation failed
        // This ensures our UI stays in sync
        setActiveCalls((prev) => prev.filter((call) => call.uuid !== callUUID));
        // Return true since the call is effectively ended from our perspective
        return true;
      }
    },
    []
  );
  // Report call connected
  const reportCallConnected = (0, react_1.useCallback)(async (callUUID) => {
    if (!callkit_1.default.isAvailable()) {
      return false;
    }
    console.log('useCallKit: Reporting call connected', { callUUID });
    const success = await callkit_1.default.reportCallConnected(callUUID);
    if (success) {
      // Update our local state to mark the call as active
      setActiveCalls((prev) =>
        prev.map((call) => (call.uuid === callUUID ? { ...call, isActive: true } : call))
      );
    }
    return success;
  }, []);
  // Update call information
  const updateCall = (0, react_1.useCallback)(async (callUUID, displayName, handle) => {
    if (!callkit_1.default.isAvailable()) {
      return false;
    }
    console.log('useCallKit: Updating call', { callUUID, displayName, handle });
    const success = await callkit_1.default.updateCall(callUUID, displayName, handle);
    if (success) {
      // Update our local state
      setActiveCalls((prev) =>
        prev.map((call) => (call.uuid === callUUID ? { ...call, displayName, handle } : call))
      );
    }
    return success;
  }, []);
  // Answer a call
  const answerCall = (0, react_1.useCallback)(async (callUUID) => {
    if (!callkit_1.default.isAvailable()) {
      return false;
    }
    console.log('useCallKit: Answering call', { callUUID });
    const success = await callkit_1.default.answerCall(callUUID);
    if (success) {
      // Update our local state to mark call as active
      setActiveCalls((prev) =>
        prev.map((call) => (call.uuid === callUUID ? { ...call, isActive: true } : call))
      );
    }
    return success;
  }, []);
  // Get CallKit UUID for a Telnyx call
  const getCallKitUUID = (0, react_1.useCallback)((call) => {
    return call._callKitUUID || null;
  }, []);
  // Set up automatic CallKit integration for a Telnyx call
  const integrateCall = (0, react_1.useCallback)(
    async (call, direction) => {
      if (!callkit_1.default.isAvailable()) {
        return null;
      }
      let callUUID = null;
      if (direction === 'incoming') {
        callUUID = await reportIncomingCall(call);
      } else {
        callUUID = await startOutgoingCall(call);
      }
      if (callUUID) {
        // Set up automatic state reporting
        const handleStateChange = async (call, state) => {
          if (state === 'active') {
            await reportCallConnected(callUUID);
          } else if (state === 'ended' || state === 'failed') {
            const reason =
              state === 'failed'
                ? callkit_1.CallEndReason.Failed
                : callkit_1.CallEndReason.RemoteEnded;
            await endCall(callUUID, reason);
          }
        };
        call.on('telnyx.call.state', handleStateChange);
      }
      return callUUID;
    },
    [reportIncomingCall, startOutgoingCall, reportCallConnected, endCall]
  );
  return {
    // State
    isAvailable,
    activeCalls,
    // Methods
    startOutgoingCall,
    reportIncomingCall,
    answerCall,
    endCall,
    reportCallConnected,
    updateCall,
    getCallKitUUID,
    integrateCall,
    // Utility
    generateCallUUID: callkit_1.default.generateCallUUID,
  };
}
