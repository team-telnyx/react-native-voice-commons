import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import VoipPushNotification from 'react-native-voip-push-notification';

interface VoipTokenFetcherProps {
  onTokenReceived?: (token: string) => void;
  debug?: boolean;
}

export function VoipTokenFetcher({ onTokenReceived, debug = false }: VoipTokenFetcherProps) {
  const log = debug ? console.log : () => {};
  const hasSetupRef = useRef(false);
  const onTokenReceivedRef = useRef(onTokenReceived);

  // Keep ref in sync with latest callback
  useEffect(() => {
    onTokenReceivedRef.current = onTokenReceived;
  }, [onTokenReceived]);

  useEffect(() => {
    // Only setup once
    if (hasSetupRef.current) {
      return;
    }
    hasSetupRef.current = true;

    const setupTokenHandling = async () => {
      try {
        if (Platform.OS === 'android') {
          // Request notification permissions for Android
          const { status: existingStatus } = await Notifications.getPermissionsAsync();
          let finalStatus = existingStatus;

          if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
          }

          if (finalStatus === 'granted') {
            // Get native FCM token instead of Expo token
            try {
              const fcmToken = await Notifications.getDevicePushTokenAsync();

              if (onTokenReceivedRef.current) {
                onTokenReceivedRef.current(fcmToken.data);
              }
            } catch (error) {
              console.warn('[VoipTokenFetcher] Failed to get Android FCM token:', error);
            }
          } else {
            console.warn('[VoipTokenFetcher] Android notification permission denied');
          }
        } else if (Platform.OS === 'ios') {
          const handleRegister = (token: string) => {
            log('[VoipTokenFetcher] iOS VoIP token received:', token);
            if (onTokenReceivedRef.current) {
              onTokenReceivedRef.current(token);
            }
          };

          const handleDidLoadWithEvents = (events: any) => {
            if (!events || !Array.isArray(events) || events.length < 1) {
              return;
            }

            for (let voipPushEvent of events) {
              let { name, data } = voipPushEvent;
              if (name === VoipPushNotification.RNVoipPushRemoteNotificationsRegisteredEvent) {
                if (onTokenReceivedRef.current && data) {
                  onTokenReceivedRef.current(data);
                }
              }
            }
          };

          VoipPushNotification.addEventListener('register', handleRegister);
          VoipPushNotification.addEventListener('didLoadWithEvents', handleDidLoadWithEvents);

          // Request VoIP push token - this should trigger the 'register' event
          VoipPushNotification.registerVoipToken();
        }
      } catch (error) {
        console.error('[VoipTokenFetcher] Error setting up token handling:', error);
      }
    };

    setupTokenHandling();

    // Cleanup function
    return () => {
      if (Platform.OS === 'ios') {
        VoipPushNotification.removeEventListener('register');
        VoipPushNotification.removeEventListener('didLoadWithEvents');
      }
    };
  }, [log]);

  // This component doesn't render anything - it's just for token handling
  return null;
}
