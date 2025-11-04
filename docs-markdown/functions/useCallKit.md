[**@telnyx/react-voice-commons-sdk v0.1.2**](../README.md)

***

[@telnyx/react-voice-commons-sdk](../globals.md) / useCallKit

# Function: useCallKit()

> **useCallKit**(`options`): `object`

Defined in: [callkit/use-callkit.ts:19](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/callkit/use-callkit.ts#L19)

## Parameters

### options

`UseCallKitOptions` = `{}`

## Returns

`object`

### isAvailable

> **isAvailable**: `boolean`

### activeCalls

> **activeCalls**: `CallKitCall`[]

### startOutgoingCall()

> **startOutgoingCall**: (`call`, `handle?`, `displayName?`) => `Promise`\<`string`\>

#### Parameters

##### call

[`TelnyxCall`](../interfaces/TelnyxCall.md)

##### handle?

`string`

##### displayName?

`string`

#### Returns

`Promise`\<`string`\>

### reportIncomingCall()

> **reportIncomingCall**: (`call`, `handle?`, `displayName?`) => `Promise`\<`string`\>

#### Parameters

##### call

[`TelnyxCall`](../interfaces/TelnyxCall.md)

##### handle?

`string`

##### displayName?

`string`

#### Returns

`Promise`\<`string`\>

### answerCall()

> **answerCall**: (`callUUID`) => `Promise`\<`boolean`\>

#### Parameters

##### callUUID

`string`

#### Returns

`Promise`\<`boolean`\>

### endCall()

> **endCall**: (`callUUID`, `reason`) => `Promise`\<`boolean`\>

#### Parameters

##### callUUID

`string`

##### reason

[`CallEndReason`](../enumerations/CallEndReason.md) = `CallEndReason.RemoteEnded`

#### Returns

`Promise`\<`boolean`\>

### reportCallConnected()

> **reportCallConnected**: (`callUUID`) => `Promise`\<`boolean`\>

#### Parameters

##### callUUID

`string`

#### Returns

`Promise`\<`boolean`\>

### updateCall()

> **updateCall**: (`callUUID`, `displayName`, `handle`) => `Promise`\<`boolean`\>

#### Parameters

##### callUUID

`string`

##### displayName

`string`

##### handle

`string`

#### Returns

`Promise`\<`boolean`\>

### getCallKitUUID()

> **getCallKitUUID**: (`call`) => `string`

#### Parameters

##### call

[`TelnyxCall`](../interfaces/TelnyxCall.md)

#### Returns

`string`

### integrateCall()

> **integrateCall**: (`call`, `direction`) => `Promise`\<`string`\>

#### Parameters

##### call

[`TelnyxCall`](../interfaces/TelnyxCall.md)

##### direction

`"incoming"` | `"outgoing"`

#### Returns

`Promise`\<`string`\>

### generateCallUUID()

> **generateCallUUID**: () => `string` = `CallKit.generateCallUUID`

#### Returns

`string`
