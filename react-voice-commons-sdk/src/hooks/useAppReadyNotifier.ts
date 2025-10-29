import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Hook to notify the native side when React Native is ready
 * Call this hook when your main screen/login screen is visible and ready
 * This is automatically called by TelnyxVoiceApp, but can be used manually if needed
 *
 * Note: With the native VoicePnManager integration, this notification is now
 * handled automatically by the native Android services, so this hook is simplified.
 */
export const useAppReadyNotifier = () => {
  useEffect(() => {
    // Only notify on Android since this is Android-specific functionality
    if (Platform.OS === 'android') {
      console.log(
        'useAppReadyNotifier: React Native is ready (native services handle FCM automatically)'
      );

      // Note: The VoicePnManager in the native Android code automatically handles
      // push notification state when the Firebase messaging service receives notifications.
      // No JavaScript module communication is needed anymore.
    }
  }, []);
};
