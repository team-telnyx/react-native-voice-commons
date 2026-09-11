# Class: Call

Defined in: [models/call.ts:14](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L14)

Represents a call with reactive state streams.

This class wraps the underlying Telnyx Call object and provides
reactive streams for all call state changes, making it easy to
integrate with any state management solution.

## Constructors

### Constructor

> **new Call**(`_telnyxCall`, `_callId`, `_destination`, `_isIncoming`, `isReattached?`, `_originalCallerName?`, `_originalCallerNumber?`): `Call`

Defined in: [models/call.ts:23](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L23)

#### Parameters

##### \_telnyxCall

[`TelnyxCall`](../interfaces/TelnyxCall.md)

##### \_callId

`string`

##### \_destination

`string`

##### \_isIncoming

`boolean`

##### isReattached?

`boolean` = `false`

##### \_originalCallerName?

`string`

##### \_originalCallerNumber?

`string`

#### Returns

`Call`

## Accessors

### callId

#### Get Signature

> **get** **callId**(): `string`

Defined in: [models/call.ts:44](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L44)

Unique identifier for this call

##### Returns

`string`

***

### destination

#### Get Signature

> **get** **destination**(): `string`

Defined in: [models/call.ts:51](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L51)

The destination number or SIP URI

##### Returns

`string`

***

### isIncoming

#### Get Signature

> **get** **isIncoming**(): `boolean`

Defined in: [models/call.ts:58](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L58)

Whether this is an incoming call

##### Returns

`boolean`

***

### isOutgoing

#### Get Signature

> **get** **isOutgoing**(): `boolean`

Defined in: [models/call.ts:65](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L65)

Whether this is an outgoing call

##### Returns

`boolean`

***

### callerName

#### Get Signature

> **get** **callerName**(): `string`

Defined in: [models/call.ts:73](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L73)

The original caller name (from_display_name) received in the INVITE message.
Falls back to destination if not available.

##### Returns

`string`

***

### callerNumber

#### Get Signature

> **get** **callerNumber**(): `string`

Defined in: [models/call.ts:81](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L81)

The original caller number received in the INVITE message.
Falls back to destination if not available.

##### Returns

`string`

***

### currentState

#### Get Signature

> **get** **currentState**(): [`TelnyxCallState`](../enumerations/TelnyxCallState.md)

Defined in: [models/call.ts:88](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L88)

Current call state (synchronous access)

##### Returns

[`TelnyxCallState`](../enumerations/TelnyxCallState.md)

***

### currentIsMuted

#### Get Signature

> **get** **currentIsMuted**(): `boolean`

Defined in: [models/call.ts:95](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L95)

Current mute state (synchronous access)

##### Returns

`boolean`

***

### currentIsHeld

#### Get Signature

> **get** **currentIsHeld**(): `boolean`

Defined in: [models/call.ts:102](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L102)

Current hold state (synchronous access)

##### Returns

`boolean`

***

### currentDuration

#### Get Signature

> **get** **currentDuration**(): `number`

Defined in: [models/call.ts:109](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L109)

Current call duration in seconds (synchronous access)

##### Returns

`number`

***

### inviteCustomHeaders

#### Get Signature

> **get** **inviteCustomHeaders**(): `object`[]

Defined in: [models/call.ts:118](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L118)

Custom headers received from the WebRTC INVITE message.
These headers are passed during call initiation and can contain application-specific information.
Format: `[{"name": "X-Header-Name", "value": "Value"}]`; header names must start with `X-`.

##### Returns

`object`[]

***

### answerCustomHeaders

#### Get Signature

> **get** **answerCustomHeaders**(): `object`[]

Defined in: [models/call.ts:127](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L127)

Custom headers received from the WebRTC ANSWER message.
These headers are passed during call acceptance and can contain application-specific information.
Format: `[{"name": "X-Header-Name", "value": "Value"}]`; header names must start with `X-`.

##### Returns

`object`[]

***

### telnyxCall

#### Get Signature

> **get** **telnyxCall**(): [`TelnyxCall`](../interfaces/TelnyxCall.md)

Defined in: [models/call.ts:135](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L135)

**`Internal`**

Get the underlying Telnyx Call object (for internal use)

##### Returns

[`TelnyxCall`](../interfaces/TelnyxCall.md)

***

### callState$

#### Get Signature

> **get** **callState$**(): `Observable`\<[`TelnyxCallState`](../enumerations/TelnyxCallState.md)\>

Defined in: [models/call.ts:142](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L142)

Observable stream of call state changes

##### Returns

`Observable`\<[`TelnyxCallState`](../enumerations/TelnyxCallState.md)\>

***

### isMuted$

#### Get Signature

> **get** **isMuted$**(): `Observable`\<`boolean`\>

Defined in: [models/call.ts:149](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L149)

Observable stream of mute state changes

##### Returns

`Observable`\<`boolean`\>

***

### isHeld$

#### Get Signature

> **get** **isHeld$**(): `Observable`\<`boolean`\>

Defined in: [models/call.ts:156](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L156)

Observable stream of hold state changes

##### Returns

`Observable`\<`boolean`\>

***

### duration$

#### Get Signature

> **get** **duration$**(): `Observable`\<`number`\>

Defined in: [models/call.ts:163](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L163)

Observable stream of call duration changes (in seconds)

##### Returns

`Observable`\<`number`\>

***

### canAnswer$

#### Get Signature

> **get** **canAnswer$**(): `Observable`\<`boolean`\>

Defined in: [models/call.ts:170](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L170)

Observable that emits true when the call can be answered

##### Returns

`Observable`\<`boolean`\>

***

### canHangup$

#### Get Signature

> **get** **canHangup$**(): `Observable`\<`boolean`\>

Defined in: [models/call.ts:180](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L180)

Observable that emits true when the call can be hung up

##### Returns

`Observable`\<`boolean`\>

***

### canHold$

#### Get Signature

> **get** **canHold$**(): `Observable`\<`boolean`\>

Defined in: [models/call.ts:190](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L190)

Observable that emits true when the call can be put on hold

##### Returns

`Observable`\<`boolean`\>

***

### canResume$

#### Get Signature

> **get** **canResume$**(): `Observable`\<`boolean`\>

Defined in: [models/call.ts:200](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L200)

Observable that emits true when the call can be resumed from hold

##### Returns

`Observable`\<`boolean`\>

## Methods

### answer()

> **answer**(`customHeaders?`): `Promise`\<`void`\>

Defined in: [models/call.ts:211](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L211)

Answer the incoming call

#### Parameters

##### customHeaders?

`object`[]

Optional custom headers to include with the answer

#### Returns

`Promise`\<`void`\>

***

### hangup()

> **hangup**(`customHeaders?`): `Promise`\<`void`\>

Defined in: [models/call.ts:243](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L243)

Hang up the call

#### Parameters

##### customHeaders?

`object`[]

Optional custom headers to include with the hangup request

#### Returns

`Promise`\<`void`\>

***

### hold()

> **hold**(): `Promise`\<`void`\>

Defined in: [models/call.ts:282](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L282)

Put the call on hold

#### Returns

`Promise`\<`void`\>

***

### resume()

> **resume**(): `Promise`\<`void`\>

Defined in: [models/call.ts:309](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L309)

Resume the call from hold

#### Returns

`Promise`\<`void`\>

***

### mute()

> **mute**(): `Promise`\<`void`\>

Defined in: [models/call.ts:336](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L336)

Mute the call

#### Returns

`Promise`\<`void`\>

***

### unmute()

> **unmute**(): `Promise`\<`void`\>

Defined in: [models/call.ts:353](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L353)

Unmute the call

#### Returns

`Promise`\<`void`\>

***

### toggleMute()

> **toggleMute**(): `Promise`\<`void`\>

Defined in: [models/call.ts:370](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L370)

Toggle mute state

#### Returns

`Promise`\<`void`\>

***

### dtmf()

> **dtmf**(`digits`): `Promise`\<`void`\>

Defined in: [models/call.ts:389](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L389)

Send DTMF tones on this call.

Each character in `digits` is sent as a Verto INFO message to the Telnyx
platform. Valid characters are `0-9`, `A-D`, `*`, and `#`; any other
characters are silently dropped by the underlying SDK.

Only valid while the call is `ACTIVE` — will throw otherwise. Safe to call
with a single digit (e.g. for IVR dialpad presses) or a whole string
(e.g. `"123#"`).

#### Parameters

##### digits

`string`

#### Returns

`Promise`\<`void`\>

***

### setConnecting()

> **setConnecting**(): `void`

Defined in: [models/call.ts:406](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L406)

**`Internal`**

Set the call to connecting state (used for push notification calls when answered via CallKit)

#### Returns

`void`

***

### dispose()

> **dispose**(): `void`

Defined in: [models/call.ts:414](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/call.ts#L414)

Clean up resources when the call is disposed

#### Returns

`void`
