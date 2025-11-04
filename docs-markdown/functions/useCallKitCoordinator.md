[**@telnyx/react-voice-commons-sdk v0.1.2**](../README.md)

***

[@telnyx/react-voice-commons-sdk](../globals.md) / useCallKitCoordinator

# Function: useCallKitCoordinator()

> **useCallKitCoordinator**(): `object`

Defined in: [hooks/use-callkit-coordinator.ts:6](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/hooks/use-callkit-coordinator.ts#L6)

## Returns

`object`

### reportIncomingCall()

> **reportIncomingCall**: (`call`, `callerName`, `callerNumber`) => `Promise`\<`string`\>

#### Parameters

##### call

[`TelnyxCall`](../interfaces/TelnyxCall.md)

##### callerName

`string`

##### callerNumber

`string`

#### Returns

`Promise`\<`string`\>

### startOutgoingCall()

> **startOutgoingCall**: (`call`, `destinationNumber`, `displayName?`) => `Promise`\<`string`\>

#### Parameters

##### call

[`TelnyxCall`](../interfaces/TelnyxCall.md)

##### destinationNumber

`string`

##### displayName?

`string`

#### Returns

`Promise`\<`string`\>

### answerCallFromUI()

> **answerCallFromUI**: (`call`) => `Promise`\<`boolean`\>

#### Parameters

##### call

[`TelnyxCall`](../interfaces/TelnyxCall.md)

#### Returns

`Promise`\<`boolean`\>

### endCallFromUI()

> **endCallFromUI**: (`call`) => `Promise`\<`boolean`\>

#### Parameters

##### call

[`TelnyxCall`](../interfaces/TelnyxCall.md)

#### Returns

`Promise`\<`boolean`\>

### getCallKitUUID()

> **getCallKitUUID**: (`call`) => `string`

#### Parameters

##### call

[`TelnyxCall`](../interfaces/TelnyxCall.md)

#### Returns

`string`

### getWebRTCCall()

> **getWebRTCCall**: (`callKitUUID`) => [`TelnyxCall`](../interfaces/TelnyxCall.md)

#### Parameters

##### callKitUUID

`string`

#### Returns

[`TelnyxCall`](../interfaces/TelnyxCall.md)

### linkExistingCallKitCall()

> **linkExistingCallKitCall**: (`call`, `callKitUUID`) => `void`

#### Parameters

##### call

[`TelnyxCall`](../interfaces/TelnyxCall.md)

##### callKitUUID

`string`

#### Returns

`void`

### isAvailable()

> **isAvailable**: () => `boolean`

#### Returns

`boolean`

### setVoipClient()

> **setVoipClient**: (`voipClient`) => `void`

#### Parameters

##### voipClient

[`TelnyxVoipClient`](../classes/TelnyxVoipClient.md)

#### Returns

`void`
