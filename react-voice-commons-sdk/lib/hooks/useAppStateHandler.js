'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.useAppStateHandler = void 0;
const react_1 = require('react');
const react_native_1 = require('react-native');
const async_storage_1 = __importDefault(require('@react-native-async-storage/async-storage'));
const connection_state_1 = require('../models/connection-state');
const call_state_1 = require('../models/call-state');
// Resolve `expo-router`'s router lazily so bare React Native projects (which
// don't have expo-router installed) can import this hook without Metro
// failing to bundle. If expo-router is absent, navigation calls become no-ops
// and the host app is responsible for redirecting to its login screen.
let router = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  router = require('expo-router').router;
} catch {
  router = null;
}
/**
 * Hook to handle app state changes for VoIP behavior
 * When app goes to background without an active call, disconnect socket and redirect to login
 */
const useAppStateHandler = ({
  voipClient,
  disconnectOnBackground = true,
  navigateToLoginOnDisconnect = true,
  debug = false,
}) => {
  const appState = (0, react_1.useRef)(react_native_1.AppState.currentState);
  const log = debug ? console.log : () => {};
  (0, react_1.useEffect)(() => {
    const handleAppStateChange = async (nextAppState) => {
      log('AppStateHandler: App state changed from', appState.current, 'to', nextAppState);
      // When app goes to background
      if (appState.current.match(/active/) && nextAppState === 'background') {
        log('AppStateHandler: App went to background, checking for active calls...');
        const connectionState = voipClient.currentConnectionState;
        if (connectionState !== connection_state_1.TelnyxConnectionState.CONNECTED) {
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
              call_state_1.CallStateHelpers.isActive(call.currentState) ||
              call.currentState === call_state_1.TelnyxCallState.RINGING
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
          const isPushNotificationInProgress = await async_storage_1.default.getItem(
            '@push_notification_payload'
          );
          if (isPushNotificationInProgress) {
            log('AppStateHandler: Push notification call in progress, keeping socket connected');
            // Wait a bit longer before allowing disconnection to give time for WebRTC call to establish
            setTimeout(async () => {
              const stillInProgress = await async_storage_1.default.getItem(
                '@push_notification_payload'
              );
              if (!stillInProgress) {
                log('AppStateHandler: Push notification call completed, now disconnecting socket');
                await voipClient.logout();
                if (navigateToLoginOnDisconnect) {
                  router?.replace('/');
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
                router?.replace('/');
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
    const subscription = react_native_1.AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription?.remove();
    };
  }, [voipClient, disconnectOnBackground, navigateToLoginOnDisconnect, log]);
  return {
    currentAppState: appState.current,
  };
};
exports.useAppStateHandler = useAppStateHandler;
