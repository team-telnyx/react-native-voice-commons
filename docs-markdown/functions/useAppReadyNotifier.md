[**@telnyx/react-voice-commons-sdk v0.1.2**](../README.md)

***

[@telnyx/react-voice-commons-sdk](../globals.md) / useAppReadyNotifier

# Function: useAppReadyNotifier()

> **useAppReadyNotifier**(): `void`

Defined in: [hooks/useAppReadyNotifier.ts:12](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/hooks/useAppReadyNotifier.ts#L12)

Hook to notify the native side when React Native is ready
Call this hook when your main screen/login screen is visible and ready
This is automatically called by TelnyxVoiceApp, but can be used manually if needed

Note: With the native VoicePnManager integration, this notification is now
handled automatically by the native Android services, so this hook is simplified.

## Returns

`void`
