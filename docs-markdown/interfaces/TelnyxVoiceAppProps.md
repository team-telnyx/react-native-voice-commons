# Interface: TelnyxVoiceAppProps

Defined in: [telnyx-voice-app.tsx:37](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L37)

Props for the TelnyxVoiceApp component

## Extends

- [`TelnyxVoiceAppOptions`](TelnyxVoiceAppOptions.md)

## Properties

### voipClient

> **voipClient**: [`TelnyxVoipClient`](../classes/TelnyxVoipClient.md)

Defined in: [telnyx-voice-app.tsx:13](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L13)

The TelnyxVoipClient instance to manage

#### Inherited from

[`TelnyxVoiceAppOptions`](TelnyxVoiceAppOptions.md).[`voipClient`](TelnyxVoiceAppOptions.md#voipclient)

***

### onPushNotificationProcessingStarted()?

> `optional` **onPushNotificationProcessingStarted**: () => `void`

Defined in: [telnyx-voice-app.tsx:16](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L16)

Optional callback when push notification processing starts

#### Returns

`void`

#### Inherited from

[`TelnyxVoiceAppOptions`](TelnyxVoiceAppOptions.md).[`onPushNotificationProcessingStarted`](TelnyxVoiceAppOptions.md#onpushnotificationprocessingstarted)

***

### onPushNotificationProcessingCompleted()?

> `optional` **onPushNotificationProcessingCompleted**: () => `void`

Defined in: [telnyx-voice-app.tsx:19](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L19)

Optional callback when push notification processing completes

#### Returns

`void`

#### Inherited from

[`TelnyxVoiceAppOptions`](TelnyxVoiceAppOptions.md).[`onPushNotificationProcessingCompleted`](TelnyxVoiceAppOptions.md#onpushnotificationprocessingcompleted)

***

### onAppStateChanged()?

> `optional` **onAppStateChanged**: (`state`) => `void`

Defined in: [telnyx-voice-app.tsx:22](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L22)

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

> `optional` **enableAutoReconnect**: `boolean`

Defined in: [telnyx-voice-app.tsx:25](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L25)

Whether to enable automatic login/reconnection (default: true)

#### Inherited from

[`TelnyxVoiceAppOptions`](TelnyxVoiceAppOptions.md).[`enableAutoReconnect`](TelnyxVoiceAppOptions.md#enableautoreconnect)

***

### skipWebBackgroundDetection?

> `optional` **skipWebBackgroundDetection**: `boolean`

Defined in: [telnyx-voice-app.tsx:28](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L28)

Whether to skip web platform for background detection (default: true)

#### Inherited from

[`TelnyxVoiceAppOptions`](TelnyxVoiceAppOptions.md).[`skipWebBackgroundDetection`](TelnyxVoiceAppOptions.md#skipwebbackgrounddetection)

***

### debug?

> `optional` **debug**: `boolean`

Defined in: [telnyx-voice-app.tsx:31](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L31)

Enable debug logging

#### Inherited from

[`TelnyxVoiceAppOptions`](TelnyxVoiceAppOptions.md).[`debug`](TelnyxVoiceAppOptions.md#debug)

***

### children

> **children**: `ReactNode`

Defined in: [telnyx-voice-app.tsx:39](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/telnyx-voice-app.tsx#L39)

The child components to render
