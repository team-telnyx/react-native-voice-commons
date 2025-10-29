/**
 * Hook to notify the native side when React Native is ready
 * Call this hook when your main screen/login screen is visible and ready
 * This is automatically called by TelnyxVoiceApp, but can be used manually if needed
 *
 * Note: With the native VoicePnManager integration, this notification is now
 * handled automatically by the native Android services, so this hook is simplified.
 */
export declare const useAppReadyNotifier: () => void;
