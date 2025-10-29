import { Platform, NativeModules, NativeEventEmitter } from 'react-native';

interface CallKitBridgeInterface {
  startOutgoingCall(
    callUUID: string,
    handle: string,
    displayName: string
  ): Promise<{ success: boolean; callUUID: string }>;
  reportIncomingCall(
    callUUID: string,
    handle: string,
    displayName: string
  ): Promise<{ success: boolean; callUUID: string }>;
  answerCall(callUUID: string): Promise<{ success: boolean; callUUID: string }>;
  endCall(callUUID: string): Promise<{ success: boolean; callUUID: string }>;
  reportCallConnected(callUUID: string): Promise<{ success: boolean }>;
  reportCallEnded(callUUID: string, reason: number): Promise<{ success: boolean }>;
  updateCall(callUUID: string, displayName: string, handle: string): Promise<{ success: boolean }>;
  getActiveCalls(): Promise<any[]>;
}

// Call end reasons
export enum CallEndReason {
  Failed = 1,
  RemoteEnded = 2,
  Unanswered = 3,
  AnsweredElsewhere = 4,
  DeclinedElsewhere = 5,
}

// CallKit event types
export interface CallKitEvent {
  callUUID: string;
  [key: string]: any;
}

class CallKitManager {
  private bridge: CallKitBridgeInterface | null = null;
  private eventEmitter: NativeEventEmitter | null = null;
  private listeners: Map<string, (event: CallKitEvent) => void> = new Map();

  /**
   * Normalize UUID to lowercase for consistent handling in React Native
   * iOS CallKit provides UUIDs in uppercase, but we want to use lowercase throughout React Native
   */
  private normalizeUUID(uuid: string): string {
    return uuid.toLowerCase();
  }

  /**
   * Denormalize UUID back to uppercase for iOS CallKit bridge calls
   * iOS CallKit expects UUIDs in uppercase format
   */
  private denormalizeUUID(uuid: string): string {
    return uuid.toUpperCase();
  }

  /**
   * Normalize event object by converting callUUID to lowercase
   */
  private normalizeEvent(event: CallKitEvent): CallKitEvent {
    return {
      ...event,
      callUUID: this.normalizeUUID(event.callUUID),
    };
  }

  constructor() {
    if (Platform.OS === 'ios') {
      const { CallKitBridge } = NativeModules;
      if (CallKitBridge) {
        this.bridge = CallKitBridge;
        this.eventEmitter = new NativeEventEmitter(CallKitBridge);
        this.setupEventListeners();
      } else {
        console.warn('CallKit: CallKitBridge not available');
      }
    }
  }

  private setupEventListeners() {
    if (!this.eventEmitter) return;

    // Listen for CallKit actions - normalize UUIDs to lowercase for React Native
    this.eventEmitter.addListener('CallKitDidReceiveStartCallAction', (event) => {
      const normalizedEvent = this.normalizeEvent(event);
      console.log('CallKit: Received start call action', normalizedEvent);
      this.notifyListeners('startCall', normalizedEvent);
    });

    this.eventEmitter.addListener('CallKitDidPerformAnswerCallAction', (event) => {
      const normalizedEvent = this.normalizeEvent(event);
      console.log('CallKit: Received answer call action', normalizedEvent);
      this.notifyListeners('answerCall', normalizedEvent);
    });

    this.eventEmitter.addListener('CallKitDidPerformEndCallAction', (event) => {
      const normalizedEvent = this.normalizeEvent(event);
      console.log('CallKit: Received end call action', normalizedEvent);
      this.notifyListeners('endCall', normalizedEvent);
    });

    this.eventEmitter.addListener('CallKitDidReceivePush', (event) => {
      const normalizedEvent = this.normalizeEvent(event);
      console.log('CallKit: Received push notification event', normalizedEvent);
      this.notifyListeners('receivePush', normalizedEvent);
    });
  }

  private notifyListeners(eventType: string, event: CallKitEvent) {
    const listener = this.listeners.get(eventType);
    if (listener) {
      listener(event);
    }
  }

  // Public API methods

  public async startOutgoingCall(
    callUUID: string,
    handle: string,
    displayName: string
  ): Promise<boolean> {
    if (!this.bridge || Platform.OS !== 'ios') {
      console.warn('CallKit: Not available on this platform');
      return false;
    }

    try {
      // Convert to uppercase for iOS CallKit bridge
      const uppercaseUUID = this.denormalizeUUID(callUUID);
      console.log('CallKit: Starting outgoing call', {
        callUUID: uppercaseUUID,
        handle,
        displayName,
      });
      const result = await this.bridge.startOutgoingCall(uppercaseUUID, handle, displayName);
      console.log('CallKit: Outgoing call started successfully', result);
      return result.success;
    } catch (error) {
      console.error('CallKit: Failed to start outgoing call', error);
      return false;
    }
  }

  public async reportIncomingCall(
    callUUID: string,
    handle: string,
    displayName: string
  ): Promise<boolean> {
    if (!this.bridge || Platform.OS !== 'ios') {
      console.warn('CallKit: Not available on this platform');
      return false;
    }

    try {
      // Convert to uppercase for iOS CallKit bridge
      const uppercaseUUID = this.denormalizeUUID(callUUID);
      console.log('CallKit: Reporting incoming call', {
        callUUID: uppercaseUUID,
        handle,
        displayName,
      });
      const result = await this.bridge.reportIncomingCall(uppercaseUUID, handle, displayName);
      console.log('CallKit: Incoming call reported successfully', result);
      return result.success;
    } catch (error) {
      console.error('CallKit: Failed to report incoming call', error);
      return false;
    }
  }

  public async answerCall(callUUID: string): Promise<boolean> {
    if (!this.bridge || Platform.OS !== 'ios') {
      console.warn('CallKit: Not available on this platform');
      return false;
    }

    try {
      // Convert to uppercase for iOS CallKit bridge
      const uppercaseUUID = this.denormalizeUUID(callUUID);
      console.log('CallKit: Answering call', { callUUID: uppercaseUUID });
      const result = await this.bridge.answerCall(uppercaseUUID);
      console.log('CallKit: Call answered successfully', result);
      return result.success;
    } catch (error) {
      console.error('CallKit: Failed to answer call', error);
      return false;
    }
  }

  public async endCall(callUUID: string): Promise<boolean> {
    if (!this.bridge || Platform.OS !== 'ios') {
      console.warn('CallKit: Not available on this platform');
      return false;
    }

    try {
      // Convert to uppercase for iOS CallKit bridge
      const uppercaseUUID = this.denormalizeUUID(callUUID);
      console.log('CallKit: Ending call', { callUUID: uppercaseUUID });
      const result = await this.bridge.endCall(uppercaseUUID);
      console.log('CallKit: Call ended successfully', result);
      return result.success;
    } catch (error) {
      console.error('CallKit: Failed to end call', error);
      return false;
    }
  }

  public async reportCallConnected(callUUID: string): Promise<boolean> {
    if (!this.bridge || Platform.OS !== 'ios') {
      return false;
    }

    try {
      // Convert to uppercase for iOS CallKit bridge
      const uppercaseUUID = this.denormalizeUUID(callUUID);
      console.log('CallKit: Reporting call connected', { callUUID: uppercaseUUID });
      const result = await this.bridge.reportCallConnected(uppercaseUUID);
      console.log('CallKit: Call connected reported successfully', result);
      return result.success;
    } catch (error) {
      console.error('CallKit: Failed to report call connected', error);
      return false;
    }
  }

  public async reportCallEnded(
    callUUID: string,
    reason: CallEndReason = CallEndReason.RemoteEnded
  ): Promise<boolean> {
    if (!this.bridge || Platform.OS !== 'ios') {
      return false;
    }

    try {
      // Convert to uppercase for iOS CallKit bridge
      const uppercaseUUID = this.denormalizeUUID(callUUID);
      console.log('CallKit: Reporting call ended', { callUUID: uppercaseUUID, reason });
      const result = await this.bridge.reportCallEnded(uppercaseUUID, reason);
      console.log('CallKit: Call ended reported successfully', result);
      return result.success;
    } catch (error) {
      console.error('CallKit: Failed to report call ended', error);
      return false;
    }
  }

  public async updateCall(callUUID: string, displayName: string, handle: string): Promise<boolean> {
    if (!this.bridge || Platform.OS !== 'ios') {
      return false;
    }

    try {
      // Convert to uppercase for iOS CallKit bridge
      const uppercaseUUID = this.denormalizeUUID(callUUID);
      console.log('CallKit: Updating call', { callUUID: uppercaseUUID, displayName, handle });
      const result = await this.bridge.updateCall(uppercaseUUID, displayName, handle);
      console.log('CallKit: Call updated successfully', result);
      return result.success;
    } catch (error) {
      console.error('CallKit: Failed to update call', error);
      return false;
    }
  }

  public async getActiveCalls(): Promise<any[]> {
    if (!this.bridge || Platform.OS !== 'ios') {
      return [];
    }

    try {
      const calls = await this.bridge.getActiveCalls();
      console.log('CallKit: Active calls retrieved', calls);
      return calls;
    } catch (error) {
      console.error('CallKit: Failed to get active calls', error);
      return [];
    }
  }

  // Event listener management

  public onStartCall(listener: (event: CallKitEvent) => void): () => void {
    this.listeners.set('startCall', listener);
    return () => this.listeners.delete('startCall');
  }

  public onAnswerCall(listener: (event: CallKitEvent) => void): () => void {
    this.listeners.set('answerCall', listener);
    return () => this.listeners.delete('answerCall');
  }

  public onEndCall(listener: (event: CallKitEvent) => void): () => void {
    this.listeners.set('endCall', listener);
    return () => this.listeners.delete('endCall');
  }

  public onReceivePush(listener: (event: CallKitEvent) => void): () => void {
    this.listeners.set('receivePush', listener);
    return () => this.listeners.delete('receivePush');
  }

  // Utility methods

  public generateCallUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  public isAvailable(): boolean {
    return Platform.OS === 'ios' && this.bridge !== null;
  }
}

// Export singleton instance
export const CallKit = new CallKitManager();
export default CallKit;
