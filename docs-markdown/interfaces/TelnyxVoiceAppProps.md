# Interface: TelnyxVoiceAppProps

Defined in: [telnyx-voice-app.tsx:69](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L69)

Props for the TelnyxVoiceApp component

## Extends

- [`TelnyxVoiceAppOptions`](TelnyxVoiceAppOptions.md)

## Properties

### voipClient

> **voipClient**: [`TelnyxVoipClient`](../classes/TelnyxVoipClient.md)

Defined in: [telnyx-voice-app.tsx:45](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L45)

The TelnyxVoipClient instance to manage

#### Inherited from

[`TelnyxVoiceAppOptions`](TelnyxVoiceAppOptions.md).[`voipClient`](TelnyxVoiceAppOptions.md#voipclient)

***

### onPushNotificationProcessingStarted?

> `optional` **onPushNotificationProcessingStarted?**: () => `void`

Defined in: [telnyx-voice-app.tsx:48](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L48)

Optional callback when push notification processing starts

#### Returns

`void`

#### Inherited from

[`TelnyxVoiceAppOptions`](TelnyxVoiceAppOptions.md).[`onPushNotificationProcessingStarted`](TelnyxVoiceAppOptions.md#onpushnotificationprocessingstarted)

***

### onPushNotificationProcessingCompleted?

> `optional` **onPushNotificationProcessingCompleted?**: () => `void`

Defined in: [telnyx-voice-app.tsx:51](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L51)

Optional callback when push notification processing completes

#### Returns

`void`

#### Inherited from

[`TelnyxVoiceAppOptions`](TelnyxVoiceAppOptions.md).[`onPushNotificationProcessingCompleted`](TelnyxVoiceAppOptions.md#onpushnotificationprocessingcompleted)

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

#### Inherited from

[`TelnyxVoiceAppOptions`](TelnyxVoiceAppOptions.md).[`onAppStateChanged`](TelnyxVoiceAppOptions.md#onappstatechanged)

***

### enableAutoReconnect?

> `optional` **enableAutoReconnect?**: `boolean`

Defined in: [telnyx-voice-app.tsx:57](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L57)

Whether to enable automatic login/reconnection (default: true)

#### Inherited from

[`TelnyxVoiceAppOptions`](TelnyxVoiceAppOptions.md).[`enableAutoReconnect`](TelnyxVoiceAppOptions.md#enableautoreconnect)

***

### skipWebBackgroundDetection?

> `optional` **skipWebBackgroundDetection?**: `boolean`

Defined in: [telnyx-voice-app.tsx:60](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L60)

Whether to skip web platform for background detection (default: true)

#### Inherited from

[`TelnyxVoiceAppOptions`](TelnyxVoiceAppOptions.md).[`skipWebBackgroundDetection`](TelnyxVoiceAppOptions.md#skipwebbackgrounddetection)

***

### debug?

> `optional` **debug?**: `boolean`

Defined in: [telnyx-voice-app.tsx:63](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L63)

Enable debug logging

#### Inherited from

[`TelnyxVoiceAppOptions`](TelnyxVoiceAppOptions.md).[`debug`](TelnyxVoiceAppOptions.md#debug)

***

### children

> **children**: `ReactNode`

Defined in: [telnyx-voice-app.tsx:71](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L71)

The child components to render
