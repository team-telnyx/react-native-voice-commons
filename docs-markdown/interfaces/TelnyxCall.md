# Interface: TelnyxCall

Defined in: [types/telnyx-sdk.d.ts:42](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L42)

## Extends

- `EventEmitter`

## Properties

### callId

> **callId**: `string`

Defined in: [types/telnyx-sdk.d.ts:43](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L43)

***

### state

> **state**: `CallState`

Defined in: [types/telnyx-sdk.d.ts:44](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L44)

***

### direction

> **direction**: `"inbound"` \| `"outbound"`

Defined in: [types/telnyx-sdk.d.ts:45](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L45)

***

### remoteCallerIdName?

> `optional` **remoteCallerIdName**: `string`

Defined in: [types/telnyx-sdk.d.ts:46](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L46)

***

### remoteCallerIdNumber?

> `optional` **remoteCallerIdNumber**: `string`

Defined in: [types/telnyx-sdk.d.ts:47](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L47)

***

### localCallerIdName?

> `optional` **localCallerIdName**: `string`

Defined in: [types/telnyx-sdk.d.ts:48](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L48)

***

### localCallerIdNumber?

> `optional` **localCallerIdNumber**: `string`

Defined in: [types/telnyx-sdk.d.ts:49](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L49)

***

### inviteCustomHeaders

> **inviteCustomHeaders**: `object`[]

Defined in: [types/telnyx-sdk.d.ts:56](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L56)

Custom headers received from the WebRTC INVITE message.
These headers are passed during call initiation and can contain application-specific information.
Format should be [{"name": "X-Header-Name", "value": "Value"}] where header names must start with "X-".

#### name

> **name**: `string`

#### value

> **value**: `string`

***

### answerCustomHeaders

> **answerCustomHeaders**: `object`[]

Defined in: [types/telnyx-sdk.d.ts:63](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L63)

Custom headers received from the WebRTC ANSWER message.
These headers are passed during call acceptance and can contain application-specific information.
Format should be [{"name": "X-Header-Name", "value": "Value"}] where header names must start with "X-".

#### name

> **name**: `string`

#### value

> **value**: `string`

## Methods

### answer()

> **answer**(`customHeaders?`): `Promise`\<`void`\>

Defined in: [types/telnyx-sdk.d.ts:67](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L67)

#### Parameters

##### customHeaders?

`object`[]

#### Returns

`Promise`\<`void`\>

***

### hangup()

> **hangup**(`customHeaders?`): `Promise`\<`void`\>

Defined in: [types/telnyx-sdk.d.ts:68](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L68)

#### Parameters

##### customHeaders?

`object`[]

#### Returns

`Promise`\<`void`\>

***

### hold()

> **hold**(): `Promise`\<`void`\>

Defined in: [types/telnyx-sdk.d.ts:69](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L69)

#### Returns

`Promise`\<`void`\>

***

### unhold()

> **unhold**(): `Promise`\<`void`\>

Defined in: [types/telnyx-sdk.d.ts:70](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L70)

#### Returns

`Promise`\<`void`\>

***

### mute()

> **mute**(): `Promise`\<`void`\>

Defined in: [types/telnyx-sdk.d.ts:71](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L71)

#### Returns

`Promise`\<`void`\>

***

### unmute()

> **unmute**(): `Promise`\<`void`\>

Defined in: [types/telnyx-sdk.d.ts:72](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L72)

#### Returns

`Promise`\<`void`\>

***

### dtmf()

> **dtmf**(`digits`): `Promise`\<`void`\>

Defined in: [types/telnyx-sdk.d.ts:73](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L73)

#### Parameters

##### digits

`string`

#### Returns

`Promise`\<`void`\>

***

### on()

> **on**(`event`, `listener`): `this`

Defined in: [types/telnyx-sdk.d.ts:75](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L75)

Add a listener for a given event.

#### Parameters

##### event

`string`

##### listener

(...`args`) => `void`

#### Returns

`this`

#### Overrides

`EventEmitter.on`

***

### off()

> **off**(`event`, `listener`): `this`

Defined in: [types/telnyx-sdk.d.ts:76](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L76)

#### Parameters

##### event

`string`

##### listener

(...`args`) => `void`

#### Returns

`this`

#### Overrides

`EventEmitter.off`

***

### emit()

> **emit**(`event`, ...`args`): `boolean`

Defined in: [types/telnyx-sdk.d.ts:77](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L77)

Calls each of the listeners registered for a given event.

#### Parameters

##### event

`string`

##### args

...`any`[]

#### Returns

`boolean`

#### Overrides

`EventEmitter.emit`
