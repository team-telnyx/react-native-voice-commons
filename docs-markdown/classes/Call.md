# Class: Call

Defined in: [models/call.ts:14](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L14)

Represents a call with reactive state streams.

This class wraps the underlying Telnyx Call object and provides
reactive streams for all call state changes, making it easy to
integrate with any state management solution.F

## Constructors

### Constructor

> **new Call**(`_telnyxCall`, `_callId`, `_destination`, `_isIncoming`): `Call`

Defined in: [models/call.ts:23](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L23)

#### Parameters

##### \_telnyxCall

[`TelnyxCall`](../interfaces/TelnyxCall.md)

##### \_callId

`string`

##### \_destination

`string`

##### \_isIncoming

`boolean`

#### Returns

`Call`

## Accessors

### callId

#### Get Signature

> **get** **callId**(): `string`

Defined in: [models/call.ts:35](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L35)

Unique identifier for this call

##### Returns

`string`

***

### destination

#### Get Signature

> **get** **destination**(): `string`

Defined in: [models/call.ts:42](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L42)

The destination number or SIP URI

##### Returns

`string`

***

### isIncoming

#### Get Signature

> **get** **isIncoming**(): `boolean`

Defined in: [models/call.ts:49](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L49)

Whether this is an incoming call

##### Returns

`boolean`

***

### isOutgoing

#### Get Signature

> **get** **isOutgoing**(): `boolean`

Defined in: [models/call.ts:56](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L56)

Whether this is an outgoing call

##### Returns

`boolean`

***

### currentState

#### Get Signature

> **get** **currentState**(): [`TelnyxCallState`](../enumerations/TelnyxCallState.md)

Defined in: [models/call.ts:63](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L63)

Current call state (synchronous access)

##### Returns

[`TelnyxCallState`](../enumerations/TelnyxCallState.md)

***

### currentIsMuted

#### Get Signature

> **get** **currentIsMuted**(): `boolean`

Defined in: [models/call.ts:70](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L70)

Current mute state (synchronous access)

##### Returns

`boolean`

***

### currentIsHeld

#### Get Signature

> **get** **currentIsHeld**(): `boolean`

Defined in: [models/call.ts:77](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L77)

Current hold state (synchronous access)

##### Returns

`boolean`

***

### currentDuration

#### Get Signature

> **get** **currentDuration**(): `number`

Defined in: [models/call.ts:84](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L84)

Current call duration in seconds (synchronous access)

##### Returns

`number`

***

### telnyxCall

#### Get Signature

> **get** **telnyxCall**(): [`TelnyxCall`](../interfaces/TelnyxCall.md)

Defined in: [models/call.ts:92](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L92)

**`Internal`**

Get the underlying Telnyx Call object (for internal use)

##### Returns

[`TelnyxCall`](../interfaces/TelnyxCall.md)

***

### callState$

#### Get Signature

> **get** **callState$**(): `Observable`\<[`TelnyxCallState`](../enumerations/TelnyxCallState.md)\>

Defined in: [models/call.ts:99](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L99)

Observable stream of call state changes

##### Returns

`Observable`\<[`TelnyxCallState`](../enumerations/TelnyxCallState.md)\>

***

### isMuted$

#### Get Signature

> **get** **isMuted$**(): `Observable`\<`boolean`\>

Defined in: [models/call.ts:106](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L106)

Observable stream of mute state changes

##### Returns

`Observable`\<`boolean`\>

***

### isHeld$

#### Get Signature

> **get** **isHeld$**(): `Observable`\<`boolean`\>

Defined in: [models/call.ts:113](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L113)

Observable stream of hold state changes

##### Returns

`Observable`\<`boolean`\>

***

### duration$

#### Get Signature

> **get** **duration$**(): `Observable`\<`number`\>

Defined in: [models/call.ts:120](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L120)

Observable stream of call duration changes (in seconds)

##### Returns

`Observable`\<`number`\>

***

### canAnswer$

#### Get Signature

> **get** **canAnswer$**(): `Observable`\<`boolean`\>

Defined in: [models/call.ts:127](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L127)

Observable that emits true when the call can be answered

##### Returns

`Observable`\<`boolean`\>

***

### canHangup$

#### Get Signature

> **get** **canHangup$**(): `Observable`\<`boolean`\>

Defined in: [models/call.ts:137](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L137)

Observable that emits true when the call can be hung up

##### Returns

`Observable`\<`boolean`\>

***

### canHold$

#### Get Signature

> **get** **canHold$**(): `Observable`\<`boolean`\>

Defined in: [models/call.ts:147](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L147)

Observable that emits true when the call can be put on hold

##### Returns

`Observable`\<`boolean`\>

***

### canResume$

#### Get Signature

> **get** **canResume$**(): `Observable`\<`boolean`\>

Defined in: [models/call.ts:157](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L157)

Observable that emits true when the call can be resumed from hold

##### Returns

`Observable`\<`boolean`\>

## Methods

### answer()

> **answer**(): `Promise`\<`void`\>

Defined in: [models/call.ts:167](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L167)

Answer the incoming call

#### Returns

`Promise`\<`void`\>

***

### hangup()

> **hangup**(): `Promise`\<`void`\>

Defined in: [models/call.ts:197](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L197)

Hang up the call

#### Returns

`Promise`\<`void`\>

***

### hold()

> **hold**(): `Promise`\<`void`\>

Defined in: [models/call.ts:224](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L224)

Put the call on hold

#### Returns

`Promise`\<`void`\>

***

### resume()

> **resume**(): `Promise`\<`void`\>

Defined in: [models/call.ts:240](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L240)

Resume the call from hold

#### Returns

`Promise`\<`void`\>

***

### mute()

> **mute**(): `Promise`\<`void`\>

Defined in: [models/call.ts:256](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L256)

Mute the call

#### Returns

`Promise`\<`void`\>

***

### unmute()

> **unmute**(): `Promise`\<`void`\>

Defined in: [models/call.ts:273](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L273)

Unmute the call

#### Returns

`Promise`\<`void`\>

***

### toggleMute()

> **toggleMute**(): `Promise`\<`void`\>

Defined in: [models/call.ts:290](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L290)

Toggle mute state

#### Returns

`Promise`\<`void`\>

***

### setConnecting()

> **setConnecting**(): `void`

Defined in: [models/call.ts:302](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L302)

**`Internal`**

Set the call to connecting state (used for push notification calls when answered via CallKit)

#### Returns

`void`

***

### dispose()

> **dispose**(): `void`

Defined in: [models/call.ts:310](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call.ts#L310)

Clean up resources when the call is disposed

#### Returns

`void`
