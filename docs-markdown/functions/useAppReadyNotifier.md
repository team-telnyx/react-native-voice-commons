# Function: useAppReadyNotifier()

> **useAppReadyNotifier**(): `void`

Defined in: [hooks/useAppReadyNotifier.ts:12](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/hooks/useAppReadyNotifier.ts#L12)

Hook to notify the native side when React Native is ready
Call this hook when your main screen/login screen is visible and ready
This is automatically called by TelnyxVoiceApp, but can be used manually if needed

Note: With the native VoicePnManager integration, this notification is now
handled automatically by the native Android services, so this hook is simplified.

## Returns

`void`
