'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.useAppReadyNotifier = void 0;
const react_1 = require('react');
const react_native_1 = require('react-native');
/**
 * Hook to notify the native side when React Native is ready
 * Call this hook when your main screen/login screen is visible and ready
 * This is automatically called by TelnyxVoiceApp, but can be used manually if needed
 *
 * Note: With the native VoicePnManager integration, this notification is now
 * handled automatically by the native Android services, so this hook is simplified.
 */
const useAppReadyNotifier = () => {
  (0, react_1.useEffect)(() => {
    // Only notify on Android since this is Android-specific functionality
    if (react_native_1.Platform.OS === 'android') {
      console.log(
        'useAppReadyNotifier: React Native is ready (native services handle FCM automatically)'
      );
      // Note: The VoicePnManager in the native Android code automatically handles
      // push notification state when the Firebase messaging service receives notifications.
      // No JavaScript module communication is needed anymore.
    }
  }, []);
};
exports.useAppReadyNotifier = useAppReadyNotifier;
