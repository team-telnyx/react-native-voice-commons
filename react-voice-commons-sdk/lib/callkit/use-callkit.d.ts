import { Call } from '@telnyx/react-native-voice-sdk';
import { CallEndReason } from './callkit';
interface UseCallKitOptions {
    onAnswerCall?: (callUUID: string) => void;
    onEndCall?: (callUUID: string) => void;
    onStartCall?: (callUUID: string) => void;
}
interface CallKitCall {
    uuid: string;
    handle: string;
    displayName: string;
    isActive: boolean;
    direction: 'incoming' | 'outgoing';
}
export declare function useCallKit(options?: UseCallKitOptions): {
    isAvailable: boolean;
    activeCalls: CallKitCall[];
    startOutgoingCall: (call: Call, handle?: string, displayName?: string) => Promise<string | null>;
    reportIncomingCall: (call: Call, handle?: string, displayName?: string) => Promise<string | null>;
    answerCall: (callUUID: string) => Promise<boolean>;
    endCall: (callUUID: string, reason?: CallEndReason) => Promise<boolean>;
    reportCallConnected: (callUUID: string) => Promise<boolean>;
    updateCall: (callUUID: string, displayName: string, handle: string) => Promise<boolean>;
    getCallKitUUID: (call: Call) => string | null;
    integrateCall: (call: Call, direction: "incoming" | "outgoing") => Promise<string>;
    generateCallUUID: () => string;
};
export {};
