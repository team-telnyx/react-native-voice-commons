import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TelnyxVoipClient } from '../telnyx-voip-client';
import { TelnyxConnectionState } from '../models/connection-state';
import { TelnyxCallState, CallStateHelpers } from '../models/call-state';

interface UseAppStateHandlerOptions {
  voipClient: TelnyxVoipClient;
  disconnectOnBackground?: boolean;
  navigateToLoginOnDisconnect?: boolean;
  debug?: boolean;
}

/**
 * Hook to handle app state changes for VoIP behavior
 * When app goes to background without an active call, disconnect socket and redirect to login
 */
export const useAppStateHandler = ({
  voipClient,
  disconnectOnBackground = true,
  navigateToLoginOnDisconnect = true,
  debug = false,
}: UseAppStateHandlerOptions) => {
  const appState = useRef(AppState.currentState);
  const log = debug ? console.log : () => {};

  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      log('AppStateHandler: App state changed from', appState.current, 'to', nextAppState);

      // When app goes to background
      if (appState.current.match(/active/) && nextAppState === 'background') {
        log('AppStateHandler: App went to background, checking for active calls...');

        const connectionState = voipClient.currentConnectionState;
        if (connectionState !== TelnyxConnectionState.CONNECTED) {
          log('AppStateHandler: Not connected, skipping background handling');
          appState.current = nextAppState;
          return;
        }

        // Check if there's an active call (including ringing calls)
        const activeCalls = voipClient.currentCalls;
        const hasActiveCall =
          activeCalls.length > 0 &&
          activeCalls.some(
            (call) =>
              CallStateHelpers.isActive(call.currentState) ||
              call.currentState === TelnyxCallState.RINGING
          );

        log('AppStateHandler: Active call check:', {
          callCount: activeCalls.length,
          hasActiveCall,
          callStates: activeCalls.map((call) => ({
            callId: call.callId,
            currentState: call.currentState,
            destination: call.destination,
            isIncoming: call.isIncoming,
          })),
        });

        if (!hasActiveCall && disconnectOnBackground) {
          // Check if there's a push notification call in progress
          const isPushNotificationInProgress = await AsyncStorage.getItem(
            '@push_notification_payload'
          );

          if (isPushNotificationInProgress) {
            log('AppStateHandler: Push notification call in progress, keeping socket connected');
            // Wait a bit longer before allowing disconnection to give time for WebRTC call to establish
            setTimeout(async () => {
              const stillInProgress = await AsyncStorage.getItem('@push_notification_payload');
              if (!stillInProgress) {
                log('AppStateHandler: Push notification call completed, now disconnecting socket');
                await voipClient.logout();
                if (navigateToLoginOnDisconnect) {
                  router.replace('/');
                }
              }
            }, 5000); // Wait 5 seconds
            appState.current = nextAppState;
            return;
          }

          log('AppStateHandler: No active call detected, disconnecting socket...');

          try {
            // Disconnect the socket with background reason
            await voipClient.logout();

            log('AppStateHandler: Socket disconnected successfully');

            // Navigate to login screen
            if (navigateToLoginOnDisconnect) {
              // Use a small delay to ensure the disconnect completes
              setTimeout(() => {
                log('AppStateHandler: Navigating to login screen');
                router.replace('/');
              }, 100);
            }
          } catch (error) {
            console.error('AppStateHandler: Error during background disconnect:', error);
          }
        } else {
          log(
            'AppStateHandler: Active call detected or disconnect disabled, keeping socket connected'
          );
        }
      }

      // When app comes to foreground
      if (appState.current.match(/background/) && nextAppState === 'active') {
        log('AppStateHandler: App came to foreground');
        // User will need to manually login again when returning from background
        // Auto-login only happens for push notification calls
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [voipClient, disconnectOnBackground, navigateToLoginOnDisconnect, log]);

  return {
    currentAppState: appState.current,
  };
};
