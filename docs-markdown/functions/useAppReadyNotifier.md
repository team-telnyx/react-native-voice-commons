# Function: useAppReadyNotifier()

> **useAppReadyNotifier**(): `void`

Defined in: [hooks/useAppReadyNotifier.ts:12](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/hooks/useAppReadyNotifier.ts#L12)

Hook to notify the native side when React Native is ready
Call this hook when your main screen/login screen is visible and ready
This is automatically called by TelnyxVoiceApp, but can be used manually if needed

Note: With the native VoicePnManager integration, this notification is now
handled automatically by the native Android services, so this hook is simplified.

## Returns

`void`
