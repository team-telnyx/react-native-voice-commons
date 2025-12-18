# Interface: TelnyxVoiceAppOptions

Defined in: [telnyx-voice-app.tsx:11](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L11)

Configuration options for TelnyxVoiceApp

## Extended by

- [`TelnyxVoiceAppProps`](TelnyxVoiceAppProps.md)

## Properties

### voipClient

> **voipClient**: [`TelnyxVoipClient`](../classes/TelnyxVoipClient.md)

Defined in: [telnyx-voice-app.tsx:13](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L13)

The TelnyxVoipClient instance to manage

***

### onPushNotificationProcessingStarted()?

> `optional` **onPushNotificationProcessingStarted**: () => `void`

Defined in: [telnyx-voice-app.tsx:16](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L16)

Optional callback when push notification processing starts

### Returns

`void`

***

### onPushNotificationProcessingCompleted()?

> `optional` **onPushNotificationProcessingCompleted**: () => `void`

Defined in: [telnyx-voice-app.tsx:19](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L19)

Optional callback when push notification processing completes

### Returns

`void`

***

### onAppStateChanged()?

> `optional` **onAppStateChanged**: (`state`) => `void`

Defined in: [telnyx-voice-app.tsx:22](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L22)

Optional callback for additional background/foreground handling

### Parameters

### state

`AppStateStatus`

### Returns

`void`

***

### enableAutoReconnect?

> `optional` **enableAutoReconnect**: `boolean`

Defined in: [telnyx-voice-app.tsx:25](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L25)

Whether to enable automatic login/reconnection (default: true)

***

### skipWebBackgroundDetection?

> `optional` **skipWebBackgroundDetection**: `boolean`

Defined in: [telnyx-voice-app.tsx:28](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L28)

Whether to skip web platform for background detection (default: true)

***

### debug?

> `optional` **debug**: `boolean`

Defined in: [telnyx-voice-app.tsx:31](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L31)

Enable debug logging



