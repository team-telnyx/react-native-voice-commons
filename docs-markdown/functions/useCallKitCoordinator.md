# Function: useCallKitCoordinator()

> **useCallKitCoordinator**(): `object`

Defined in: [hooks/use-callkit-coordinator.ts:6](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/hooks/use-callkit-coordinator.ts#L6)

## Returns

### reportIncomingCall

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

### startOutgoingCall

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

### answerCallFromUI

> **answerCallFromUI**: (`call`) => `Promise`\<`boolean`\>

#### Parameters

##### call

[`TelnyxCall`](../interfaces/TelnyxCall.md)

#### Returns

`Promise`\<`boolean`\>

### endCallFromUI

> **endCallFromUI**: (`call`) => `Promise`\<`boolean`\>

#### Parameters

##### call

[`TelnyxCall`](../interfaces/TelnyxCall.md)

#### Returns

`Promise`\<`boolean`\>

### getCallKitUUID

> **getCallKitUUID**: (`call`) => `string`

#### Parameters

##### call

[`TelnyxCall`](../interfaces/TelnyxCall.md)

#### Returns

`string`

### getWebRTCCall

> **getWebRTCCall**: (`callKitUUID`) => [`TelnyxCall`](../interfaces/TelnyxCall.md)

#### Parameters

##### callKitUUID

`string`

#### Returns

[`TelnyxCall`](../interfaces/TelnyxCall.md)

### linkExistingCallKitCall

> **linkExistingCallKitCall**: (`call`, `callKitUUID`) => `void`

#### Parameters

##### call

[`TelnyxCall`](../interfaces/TelnyxCall.md)

##### callKitUUID

`string`

#### Returns

`void`

### isAvailable

> **isAvailable**: () => `boolean`

#### Returns

`boolean`

### ~~setVoipClient~~

> **setVoipClient**: (`voipClient`) => `void`

#### Parameters

##### voipClient

[`TelnyxVoipClient`](../classes/TelnyxVoipClient.md)

#### Returns

`void`

#### Deprecated

No longer needed — TelnyxVoiceApp now auto-wires the voipClient
on the CallKit coordinator when it receives the voipClient prop.
This method is kept for backwards compatibility and will be removed in a future release.
