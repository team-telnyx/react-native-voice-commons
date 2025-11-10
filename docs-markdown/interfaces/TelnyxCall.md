# Interface: TelnyxCall

Defined in: [types/telnyx-sdk.d.ts:42](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L42)

## Extends

- `EventEmitter`

## Properties

### callId

> **callId**: `string`

Defined in: [types/telnyx-sdk.d.ts:43](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L43)

***

### state

> **state**: `CallState`

Defined in: [types/telnyx-sdk.d.ts:44](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L44)

***

### direction

> **direction**: `"inbound"` \| `"outbound"`

Defined in: [types/telnyx-sdk.d.ts:45](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L45)

***

### remoteCallerIdName?

> `optional` **remoteCallerIdName**: `string`

Defined in: [types/telnyx-sdk.d.ts:46](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L46)

***

### remoteCallerIdNumber?

> `optional` **remoteCallerIdNumber**: `string`

Defined in: [types/telnyx-sdk.d.ts:47](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L47)

***

### localCallerIdName?

> `optional` **localCallerIdName**: `string`

Defined in: [types/telnyx-sdk.d.ts:48](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L48)

***

### localCallerIdNumber?

> `optional` **localCallerIdNumber**: `string`

Defined in: [types/telnyx-sdk.d.ts:49](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L49)

## Methods

### answer()

> **answer**(): `Promise`\<`void`\>

Defined in: [types/telnyx-sdk.d.ts:53](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L53)

#### Returns

`Promise`\<`void`\>

***

### hangup()

> **hangup**(): `Promise`\<`void`\>

Defined in: [types/telnyx-sdk.d.ts:54](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L54)

#### Returns

`Promise`\<`void`\>

***

### hold()

> **hold**(): `Promise`\<`void`\>

Defined in: [types/telnyx-sdk.d.ts:55](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L55)

#### Returns

`Promise`\<`void`\>

***

### unhold()

> **unhold**(): `Promise`\<`void`\>

Defined in: [types/telnyx-sdk.d.ts:56](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L56)

#### Returns

`Promise`\<`void`\>

***

### mute()

> **mute**(): `Promise`\<`void`\>

Defined in: [types/telnyx-sdk.d.ts:57](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L57)

#### Returns

`Promise`\<`void`\>

***

### unmute()

> **unmute**(): `Promise`\<`void`\>

Defined in: [types/telnyx-sdk.d.ts:58](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L58)

#### Returns

`Promise`\<`void`\>

***

### dtmf()

> **dtmf**(`digits`): `Promise`\<`void`\>

Defined in: [types/telnyx-sdk.d.ts:59](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L59)

#### Parameters

##### digits

`string`

#### Returns

`Promise`\<`void`\>

***

### on()

> **on**(`event`, `listener`): `this`

Defined in: [types/telnyx-sdk.d.ts:61](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L61)

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

Defined in: [types/telnyx-sdk.d.ts:62](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L62)

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

Defined in: [types/telnyx-sdk.d.ts:63](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/types/telnyx-sdk.d.ts#L63)

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
