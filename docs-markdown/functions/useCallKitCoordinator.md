# Function: useCallKitCoordinator()

> **useCallKitCoordinator**(): `object`

Defined in: [hooks/use-callkit-coordinator.ts:6](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/hooks/use-callkit-coordinator.ts#L6)

## Returns

`object`

### reportIncomingCall()

> **reportIncomingCall**: (`call`, `callerName`, `callerNumber`) => `Promise`\<`string`\>

### Parameters

### call

[`TelnyxCall`](../interfaces/TelnyxCall.md)

### callerName

`string`

### callerNumber

`string`

### Returns

`Promise`\<`string`\>

### startOutgoingCall()

> **startOutgoingCall**: (`call`, `destinationNumber`, `displayName?`) => `Promise`\<`string`\>

### Parameters

### call

[`TelnyxCall`](../interfaces/TelnyxCall.md)

### destinationNumber

`string`

### displayName?

`string`

### Returns

`Promise`\<`string`\>

### answerCallFromUI()

> **answerCallFromUI**: (`call`) => `Promise`\<`boolean`\>

### Parameters

### call

[`TelnyxCall`](../interfaces/TelnyxCall.md)

### Returns

`Promise`\<`boolean`\>

### endCallFromUI()

> **endCallFromUI**: (`call`) => `Promise`\<`boolean`\>

### Parameters

### call

[`TelnyxCall`](../interfaces/TelnyxCall.md)

### Returns

`Promise`\<`boolean`\>

### getCallKitUUID()

> **getCallKitUUID**: (`call`) => `string`

### Parameters

### call

[`TelnyxCall`](../interfaces/TelnyxCall.md)

### Returns

`string`

### getWebRTCCall()

> **getWebRTCCall**: (`callKitUUID`) => [`TelnyxCall`](../interfaces/TelnyxCall.md)

### Parameters

### callKitUUID

`string`

### Returns

[`TelnyxCall`](../interfaces/TelnyxCall.md)

### linkExistingCallKitCall()

> **linkExistingCallKitCall**: (`call`, `callKitUUID`) => `void`

### Parameters

### call

[`TelnyxCall`](../interfaces/TelnyxCall.md)

### callKitUUID

`string`

### Returns

`void`

### isAvailable()

> **isAvailable**: () => `boolean`

### Returns

`boolean`

### setVoipClient()

> **setVoipClient**: (`voipClient`) => `void`

### Parameters

### voipClient

[`TelnyxVoipClient`](../classes/TelnyxVoipClient.md)

### Returns

`void`


