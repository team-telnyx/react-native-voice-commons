# Interface: TelnyxCall

Defined in: [types/telnyx-sdk.d.ts:58](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L58)

## Extends

- `EventEmitter`

## Properties

### callId

> **callId**: `string`

Defined in: [types/telnyx-sdk.d.ts:59](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L59)

***

### state

> **state**: `CallState`

Defined in: [types/telnyx-sdk.d.ts:60](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L60)

***

### direction

> **direction**: `"inbound"` \| `"outbound"`

Defined in: [types/telnyx-sdk.d.ts:61](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L61)

***

### remoteCallerIdName?

> `optional` **remoteCallerIdName?**: `string`

Defined in: [types/telnyx-sdk.d.ts:62](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L62)

***

### remoteCallerIdNumber?

> `optional` **remoteCallerIdNumber?**: `string`

Defined in: [types/telnyx-sdk.d.ts:63](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L63)

***

### localCallerIdName?

> `optional` **localCallerIdName?**: `string`

Defined in: [types/telnyx-sdk.d.ts:64](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L64)

***

### localCallerIdNumber?

> `optional` **localCallerIdNumber?**: `string`

Defined in: [types/telnyx-sdk.d.ts:65](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L65)

***

### inviteCustomHeaders

> **inviteCustomHeaders**: `object`[]

Defined in: [types/telnyx-sdk.d.ts:72](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L72)

Custom headers received from the WebRTC INVITE message.
These headers are passed during call initiation and can contain application-specific information.
Format: `[{"name": "X-Header-Name", "value": "Value"}]`; header names must start with `X-`.

#### name

> **name**: `string`

#### value

> **value**: `string`

***

### answerCustomHeaders

> **answerCustomHeaders**: `object`[]

Defined in: [types/telnyx-sdk.d.ts:79](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L79)

Custom headers received from the WebRTC ANSWER message.
These headers are passed during call acceptance and can contain application-specific information.
Format: `[{"name": "X-Header-Name", "value": "Value"}]`; header names must start with `X-`.

#### name

> **name**: `string`

#### value

> **value**: `string`

## Methods

### answer()

> **answer**(`customHeaders?`): `Promise`\<`void`\>

Defined in: [types/telnyx-sdk.d.ts:83](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L83)

#### Parameters

##### customHeaders?

`object`[]

#### Returns

`Promise`\<`void`\>

***

### hangup()

> **hangup**(`customHeaders?`): `Promise`\<`void`\>

Defined in: [types/telnyx-sdk.d.ts:84](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L84)

#### Parameters

##### customHeaders?

`object`[]

#### Returns

`Promise`\<`void`\>

***

### hold()

> **hold**(): `Promise`\<`void`\>

Defined in: [types/telnyx-sdk.d.ts:85](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L85)

#### Returns

`Promise`\<`void`\>

***

### unhold()

> **unhold**(): `Promise`\<`void`\>

Defined in: [types/telnyx-sdk.d.ts:86](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L86)

#### Returns

`Promise`\<`void`\>

***

### mute()

> **mute**(): `Promise`\<`void`\>

Defined in: [types/telnyx-sdk.d.ts:87](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L87)

#### Returns

`Promise`\<`void`\>

***

### unmute()

> **unmute**(): `Promise`\<`void`\>

Defined in: [types/telnyx-sdk.d.ts:88](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L88)

#### Returns

`Promise`\<`void`\>

***

### dtmf()

> **dtmf**(`digits`): `Promise`\<`void`\>

Defined in: [types/telnyx-sdk.d.ts:89](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L89)

#### Parameters

##### digits

`string`

#### Returns

`Promise`\<`void`\>

***

### on()

> **on**(`event`, `listener`): `this`

Defined in: [types/telnyx-sdk.d.ts:91](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L91)

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

Defined in: [types/telnyx-sdk.d.ts:92](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L92)

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

Defined in: [types/telnyx-sdk.d.ts:93](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L93)

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
