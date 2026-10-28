'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.useCallKitCoordinator = useCallKitCoordinator;
const react_1 = require('react');
const callkit_coordinator_1 = __importDefault(require('../callkit/callkit-coordinator'));
function useCallKitCoordinator() {
  const reportIncomingCall = (0, react_1.useCallback)(async (call, callerName, callerNumber) => {
    return callkit_coordinator_1.default.reportIncomingCall(call, callerName, callerNumber);
  }, []);
  const startOutgoingCall = (0, react_1.useCallback)(
    async (call, destinationNumber, displayName) => {
      return callkit_coordinator_1.default.startOutgoingCall(call, destinationNumber, displayName);
    },
    []
  );
  const answerCallFromUI = (0, react_1.useCallback)(async (call) => {
    return callkit_coordinator_1.default.answerCallFromUI(call);
  }, []);
  const endCallFromUI = (0, react_1.useCallback)(async (call) => {
    return callkit_coordinator_1.default.endCallFromUI(call);
  }, []);
  const getCallKitUUID = (0, react_1.useCallback)((call) => {
    return callkit_coordinator_1.default.getCallKitUUID(call);
  }, []);
  const getWebRTCCall = (0, react_1.useCallback)((callKitUUID) => {
    return callkit_coordinator_1.default.getWebRTCCall(callKitUUID);
  }, []);
  const linkExistingCallKitCall = (0, react_1.useCallback)((call, callKitUUID) => {
    callkit_coordinator_1.default.linkExistingCallKitCall(call, callKitUUID);
  }, []);
  const isAvailable = (0, react_1.useCallback)(() => {
    return callkit_coordinator_1.default.isAvailable();
  }, []);
  /**
   * @deprecated No longer needed — TelnyxVoiceApp now auto-wires the voipClient
   * on the CallKit coordinator when it receives the voipClient prop.
   * This method is kept for backwards compatibility and will be removed in a future release.
   */
  const setVoipClient = (0, react_1.useCallback)((voipClient) => {
    callkit_coordinator_1.default.setVoipClient(voipClient);
  }, []);
  return {
    reportIncomingCall,
    startOutgoingCall,
    answerCallFromUI,
    endCallFromUI,
    getCallKitUUID,
    getWebRTCCall,
    linkExistingCallKitCall,
    isAvailable,
    setVoipClient,
  };
}
