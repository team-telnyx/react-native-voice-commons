interface UseCallKitOptions {
    onAnswerCall?: (callUUID: string) => void;
    onEndCall?: (callUUID: string) => void;
    onStartCall?: (callUUID: string) => void;
}
export declare function useCallKit(options?: UseCallKitOptions): {
    isAvailable: any;
    activeCalls: any;
    startOutgoingCall: any;
    reportIncomingCall: any;
    answerCall: any;
    endCall: any;
    reportCallConnected: any;
    updateCall: any;
    getCallKitUUID: any;
    integrateCall: any;
    generateCallUUID: () => string;
};
export {};
