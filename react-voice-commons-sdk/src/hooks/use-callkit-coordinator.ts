import { useCallback } from 'react';
import { Call } from '@telnyx/react-native-voice-sdk';
import callKitCoordinator from '../callkit/callkit-coordinator';
import { TelnyxVoipClient } from '../telnyx-voip-client';

export function useCallKitCoordinator() {
  const reportIncomingCall = useCallback(
    async (call: Call, callerName: string, callerNumber: string): Promise<string | null> => {
      return callKitCoordinator.reportIncomingCall(call, callerName, callerNumber);
    },
    []
  );

  const startOutgoingCall = useCallback(
    async (call: Call, destinationNumber: string, displayName?: string): Promise<string | null> => {
      return callKitCoordinator.startOutgoingCall(call, destinationNumber, displayName);
    },
    []
  );

  const answerCallFromUI = useCallback(async (call: Call): Promise<boolean> => {
    return callKitCoordinator.answerCallFromUI(call);
  }, []);

  const endCallFromUI = useCallback(async (call: Call): Promise<boolean> => {
    return callKitCoordinator.endCallFromUI(call);
  }, []);

  const getCallKitUUID = useCallback((call: Call): string | null => {
    return callKitCoordinator.getCallKitUUID(call);
  }, []);

  const getWebRTCCall = useCallback((callKitUUID: string): Call | null => {
    return callKitCoordinator.getWebRTCCall(callKitUUID);
  }, []);

  const linkExistingCallKitCall = useCallback((call: Call, callKitUUID: string): void => {
    callKitCoordinator.linkExistingCallKitCall(call, callKitUUID);
  }, []);

  const isAvailable = useCallback((): boolean => {
    return callKitCoordinator.isAvailable();
  }, []);

  const setVoipClient = useCallback((voipClient: TelnyxVoipClient): void => {
    callKitCoordinator.setVoipClient(voipClient);
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
