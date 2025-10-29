import React, { useEffect, useRef } from 'react';
import { Platform, DeviceEventEmitter } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTelnyxVoice } from '../context/TelnyxVoiceContext';
import { callKitCoordinator } from '../callkit';

// Global flag to ensure only one CallKitHandler is active
let isCallKitHandlerActive = false;

interface CallData {
  type: string;
  callUUID: string;
  payload?: any;
  callData?: any;
  action: string;
}

interface CallKitHandlerProps {
  /** Callback when user needs to login from push notification */
  onLoginRequired?: (pushPayload: any) => void;
  /** Callback when call is answered and user should navigate to dialer */
  onNavigateToDialer?: () => void;
  /** Callback when call ends and user should navigate back */
  onNavigateBack?: () => void;
}

/**
 * Internal CallKit handler for iOS push notifications
 * This component is automatically included in TelnyxVoiceApp
 *
 * @internal - Users should not use this component directly
 */
export const CallKitHandler: React.FC<CallKitHandlerProps> = ({
  onLoginRequired,
  onNavigateToDialer,
  onNavigateBack,
}) => {
  const router = useRouter();
  const { voipClient } = useTelnyxVoice();

  // Store active calls by CallKit UUID for coordination
  const activeCallsRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    if (isCallKitHandlerActive) {
      console.log('CallKitHandler: Another instance is already active, skipping setup');
      return;
    }

    isCallKitHandlerActive = true;
    console.log('CallKitHandler: Setting up DeviceEventEmitter listeners (singleton instance)...');

    DeviceEventEmitter.removeAllListeners('incomingVoIPCall');
    DeviceEventEmitter.removeAllListeners('callKitAction');

    const incomingCallListener = DeviceEventEmitter.addListener(
      'incomingVoIPCall',
      async (eventData: CallData) => {
        console.log('🔥 CallKitHandler: Incoming VoIP call received:', eventData);
        if (eventData.action === 'connect_webrtc') {
          await handleIncomingCall(eventData);
        }
      }
    );

    const callKitActionListener = DeviceEventEmitter.addListener(
      'callKitAction',
      async (eventData: CallData) => {
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

  const handleIncomingCall = async (eventData: CallData) => {
    console.log('CallKitHandler: Handling incoming call', {
      callUUID: eventData.callUUID,
      hasClient: !!voipClient,
    });

    // Store the push notification payload
    await AsyncStorage.setItem('@push_notification_payload', JSON.stringify(eventData.payload));

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

  const handleAnswerCall = async (eventData: CallData) => {
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

  const handleEndCall = async (eventData: CallData) => {
    console.log('CallKitHandler: User ended call via CallKit', {
      callUUID: eventData.callUUID,
      isTrackedCall: activeCallsRef.current.has(eventData.callUUID),
    });

    // Clean up our local tracking info
    activeCallsRef.current.delete(eventData.callUUID);
    await AsyncStorage.removeItem('@push_notification_payload');

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
