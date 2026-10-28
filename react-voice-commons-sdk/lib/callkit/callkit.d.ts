export declare enum CallEndReason {
  Failed = 1,
  RemoteEnded = 2,
  Unanswered = 3,
  AnsweredElsewhere = 4,
  DeclinedElsewhere = 5,
}
export interface CallKitEvent {
  callUUID: string;
  isOnHold?: boolean;
  [key: string]: any;
}
declare class CallKitManager {
  private bridge;
  private eventEmitter;
  private listeners;
  /**
   * Normalize UUID to lowercase for consistent handling in React Native
   * iOS CallKit provides UUIDs in uppercase, but we want to use lowercase throughout React Native
   */
  private normalizeUUID;
  /**
   * Denormalize UUID back to uppercase for iOS CallKit bridge calls
   * iOS CallKit expects UUIDs in uppercase format
   */
  private denormalizeUUID;
  /**
   * Normalize event object by converting callUUID to lowercase
   */
  private normalizeEvent;
  constructor();
  private setupEventListeners;
  private notifyListeners;
  startOutgoingCall(callUUID: string, handle: string, displayName: string): Promise<boolean>;
  reportIncomingCall(callUUID: string, handle: string, displayName: string): Promise<boolean>;
  answerCall(callUUID: string): Promise<boolean>;
  isCallRegistered(callUUID: string): Promise<boolean>;
  endCall(callUUID: string): Promise<boolean>;
  completeHeldCallAction(callUUID: string, success: boolean): Promise<boolean>;
  setCallHeld(callUUID: string, isOnHold: boolean): Promise<boolean>;
  swapCalls(activeCallUUID: string, heldCallUUID: string): Promise<boolean>;
  reportCallConnected(callUUID: string): Promise<boolean>;
  reportCallEnded(callUUID: string, reason?: CallEndReason): Promise<boolean>;
  updateCall(callUUID: string, displayName: string, handle: string): Promise<boolean>;
  getActiveCalls(): Promise<any[]>;
  onStartCall(listener: (event: CallKitEvent) => void): () => void;
  onAnswerCall(listener: (event: CallKitEvent) => void): () => void;
  onEndCall(listener: (event: CallKitEvent) => void): () => void;
  onHeldCall(listener: (event: CallKitEvent) => void): () => void;
  onReceivePush(listener: (event: CallKitEvent) => void): () => void;
  private addListener;
  generateCallUUID(): string;
  isAvailable(): boolean;
}
export declare const CallKit: CallKitManager;
export default CallKit;
