'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.CallKit = exports.CallEndReason = void 0;
const react_native_1 = require('react-native');
// Call end reasons
var CallEndReason;
(function (CallEndReason) {
  CallEndReason[(CallEndReason['Failed'] = 1)] = 'Failed';
  CallEndReason[(CallEndReason['RemoteEnded'] = 2)] = 'RemoteEnded';
  CallEndReason[(CallEndReason['Unanswered'] = 3)] = 'Unanswered';
  CallEndReason[(CallEndReason['AnsweredElsewhere'] = 4)] = 'AnsweredElsewhere';
  CallEndReason[(CallEndReason['DeclinedElsewhere'] = 5)] = 'DeclinedElsewhere';
})(CallEndReason || (exports.CallEndReason = CallEndReason = {}));
class CallKitManager {
  /**
   * Normalize UUID to lowercase for consistent handling in React Native
   * iOS CallKit provides UUIDs in uppercase, but we want to use lowercase throughout React Native
   */
  normalizeUUID(uuid) {
    return uuid.toLowerCase();
  }
  /**
   * Denormalize UUID back to uppercase for iOS CallKit bridge calls
   * iOS CallKit expects UUIDs in uppercase format
   */
  denormalizeUUID(uuid) {
    return uuid.toUpperCase();
  }
  /**
   * Normalize event object by converting callUUID to lowercase
   */
  normalizeEvent(event) {
    return {
      ...event,
      callUUID: this.normalizeUUID(event.callUUID),
    };
  }
  constructor() {
    this.bridge = null;
    this.eventEmitter = null;
    this.listeners = new Map();
    if (react_native_1.Platform.OS === 'ios') {
      const { CallKitBridge } = react_native_1.NativeModules;
      if (CallKitBridge) {
        this.bridge = CallKitBridge;
        this.eventEmitter = new react_native_1.NativeEventEmitter(CallKitBridge);
        this.setupEventListeners();
      } else {
        console.warn('CallKit: CallKitBridge not available');
      }
    }
  }
  setupEventListeners() {
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
  notifyListeners(eventType, event) {
    const listener = this.listeners.get(eventType);
    if (listener) {
      listener(event);
    }
  }
  // Public API methods
  async startOutgoingCall(callUUID, handle, displayName) {
    if (!this.bridge || react_native_1.Platform.OS !== 'ios') {
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
  async reportIncomingCall(callUUID, handle, displayName) {
    if (!this.bridge || react_native_1.Platform.OS !== 'ios') {
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
  async answerCall(callUUID) {
    if (!this.bridge || react_native_1.Platform.OS !== 'ios') {
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
  async endCall(callUUID) {
    if (!this.bridge || react_native_1.Platform.OS !== 'ios') {
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
  async reportCallConnected(callUUID) {
    if (!this.bridge || react_native_1.Platform.OS !== 'ios') {
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
  async reportCallEnded(callUUID, reason = CallEndReason.RemoteEnded) {
    if (!this.bridge || react_native_1.Platform.OS !== 'ios') {
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
  async updateCall(callUUID, displayName, handle) {
    if (!this.bridge || react_native_1.Platform.OS !== 'ios') {
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
  async getActiveCalls() {
    if (!this.bridge || react_native_1.Platform.OS !== 'ios') {
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
  onStartCall(listener) {
    this.listeners.set('startCall', listener);
    return () => this.listeners.delete('startCall');
  }
  onAnswerCall(listener) {
    this.listeners.set('answerCall', listener);
    return () => this.listeners.delete('answerCall');
  }
  onEndCall(listener) {
    this.listeners.set('endCall', listener);
    return () => this.listeners.delete('endCall');
  }
  onReceivePush(listener) {
    this.listeners.set('receivePush', listener);
    return () => this.listeners.delete('receivePush');
  }
  // Utility methods
  generateCallUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  isAvailable() {
    return react_native_1.Platform.OS === 'ios' && this.bridge !== null;
  }
}
// Export singleton instance
exports.CallKit = new CallKitManager();
exports.default = exports.CallKit;
