'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.CallKitHandler = void 0;
const react_1 = require('react');
const react_native_1 = require('react-native');
const expo_router_1 = require('expo-router');
const async_storage_1 = __importDefault(require('@react-native-async-storage/async-storage'));
const TelnyxVoiceContext_1 = require('../context/TelnyxVoiceContext');
// Global flag to ensure only one CallKitHandler is active
let isCallKitHandlerActive = false;
/**
 * Internal CallKit handler for iOS push notifications
 * This component is automatically included in TelnyxVoiceApp
 *
 * @internal - Users should not use this component directly
 */
const CallKitHandler = ({ onLoginRequired, onNavigateToDialer, onNavigateBack }) => {
  const router = (0, expo_router_1.useRouter)();
  const { voipClient } = (0, TelnyxVoiceContext_1.useTelnyxVoice)();
  // Store active calls by CallKit UUID for coordination
  const activeCallsRef = (0, react_1.useRef)(new Map());
  (0, react_1.useEffect)(() => {
    if (react_native_1.Platform.OS !== 'ios') return;
    if (isCallKitHandlerActive) {
      console.log('CallKitHandler: Another instance is already active, skipping setup');
      return;
    }
    isCallKitHandlerActive = true;
    console.log('CallKitHandler: Setting up DeviceEventEmitter listeners (singleton instance)...');
    react_native_1.DeviceEventEmitter.removeAllListeners('incomingVoIPCall');
    react_native_1.DeviceEventEmitter.removeAllListeners('callKitAction');
    const incomingCallListener = react_native_1.DeviceEventEmitter.addListener(
      'incomingVoIPCall',
      async (eventData) => {
        console.log('🔥 CallKitHandler: Incoming VoIP call received:', eventData);
        if (eventData.action === 'connect_webrtc') {
          await handleIncomingCall(eventData);
        }
      }
    );
    const callKitActionListener = react_native_1.DeviceEventEmitter.addListener(
      'callKitAction',
      async (eventData) => {
        console.log('🔥 CallKitHandler: CallKit action received:', eventData);
        switch (eventData.action) {
          case 'answer':
            await handleAnswerCall(eventData);
            break;
          case 'end':
            await handleEndCall(eventData);
            break;
        }
      }
    );
    console.log('CallKitHandler: DeviceEventEmitter listeners set up successfully');
    return () => {
      console.log('CallKitHandler: Cleaning up DeviceEventEmitter listeners');
      incomingCallListener.remove();
      callKitActionListener.remove();
      isCallKitHandlerActive = false;
    };
  }, []);
  const handleIncomingCall = async (eventData) => {
    console.log('CallKitHandler: Handling incoming call', {
      callUUID: eventData.callUUID,
      hasClient: !!voipClient,
    });
    // Store the push notification payload
    await async_storage_1.default.setItem(
      '@push_notification_payload',
      JSON.stringify(eventData.payload)
    );
    // Mark this call as being processed
    activeCallsRef.current.set(eventData.callUUID, {
      processing: true,
      timestamp: Date.now(),
    });
    // Trigger login required callback if provided
    if (onLoginRequired) {
      onLoginRequired(eventData.payload);
    }
  };
  const handleAnswerCall = async (eventData) => {
    console.log('CallKitHandler: User answered call via CallKit', {
      callUUID: eventData.callUUID,
      isTrackedCall: activeCallsRef.current.has(eventData.callUUID),
    });
    // Navigate to dialer after answering
    if (onNavigateToDialer) {
      onNavigateToDialer();
    } else {
      router.replace('/dialer');
    }
  };
  const handleEndCall = async (eventData) => {
    console.log('CallKitHandler: User ended call via CallKit', {
      callUUID: eventData.callUUID,
      isTrackedCall: activeCallsRef.current.has(eventData.callUUID),
    });
    // Clean up our local tracking info
    activeCallsRef.current.delete(eventData.callUUID);
    await async_storage_1.default.removeItem('@push_notification_payload');
    // Navigate back after call ends
    if (onNavigateBack) {
      onNavigateBack();
    } else {
      router.replace('/dialer');
    }
  };
  // This component doesn't render anything, it just handles events
  return null;
};
exports.CallKitHandler = CallKitHandler;
