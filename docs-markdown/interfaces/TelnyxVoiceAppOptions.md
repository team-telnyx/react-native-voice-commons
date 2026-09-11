# Interface: TelnyxVoiceAppOptions

Defined in: [telnyx-voice-app.tsx:43](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L43)

Configuration options for TelnyxVoiceApp

## Extended by

- [`TelnyxVoiceAppProps`](TelnyxVoiceAppProps.md)

## Properties

### voipClient

> **voipClient**: [`TelnyxVoipClient`](../classes/TelnyxVoipClient.md)

Defined in: [telnyx-voice-app.tsx:45](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L45)

The TelnyxVoipClient instance to manage

***

### onPushNotificationProcessingStarted?

> `optional` **onPushNotificationProcessingStarted?**: () => `void`

Defined in: [telnyx-voice-app.tsx:48](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L48)

Optional callback when push notification processing starts

#### Returns

`void`

***

### onPushNotificationProcessingCompleted?

> `optional` **onPushNotificationProcessingCompleted?**: () => `void`

Defined in: [telnyx-voice-app.tsx:51](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L51)

Optional callback when push notification processing completes

#### Returns

`void`

***

### onAppStateChanged?

> `optional` **onAppStateChanged?**: (`state`) => `void`

Defined in: [telnyx-voice-app.tsx:54](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L54)

Optional callback for additional background/foreground handling

#### Parameters

##### state

`AppStateStatus`

#### Returns

`void`

***

### enableAutoReconnect?

> `optional` **enableAutoReconnect?**: `boolean`

Defined in: [telnyx-voice-app.tsx:57](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L57)

Whether to enable automatic login/reconnection (default: true)

***

### skipWebBackgroundDetection?

> `optional` **skipWebBackgroundDetection?**: `boolean`

Defined in: [telnyx-voice-app.tsx:60](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L60)

Whether to skip web platform for background detection (default: true)

***

### debug?

> `optional` **debug?**: `boolean`

Defined in: [telnyx-voice-app.tsx:63](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L63)

Enable debug logging
