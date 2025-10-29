import { Call } from '@telnyx/react-native-voice-sdk';
import { TelnyxVoipClient } from '../telnyx-voip-client';
export declare function useCallKitCoordinator(): {
    reportIncomingCall: (call: Call, callerName: string, callerNumber: string) => Promise<string | null>;
    startOutgoingCall: (call: Call, destinationNumber: string, displayName?: string) => Promise<string | null>;
    answerCallFromUI: (call: Call) => Promise<boolean>;
    endCallFromUI: (call: Call) => Promise<boolean>;
    getCallKitUUID: (call: Call) => string | null;
    getWebRTCCall: (callKitUUID: string) => Call | null;
    linkExistingCallKitCall: (call: Call, callKitUUID: string) => void;
    isAvailable: () => boolean;
    setVoipClient: (voipClient: TelnyxVoipClient) => void;
};
