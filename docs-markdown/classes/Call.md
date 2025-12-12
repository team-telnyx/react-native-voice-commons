# Class: Call

Defined in: [models/call.ts:14](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L14)

Represents a call with reactive state streams.

This class wraps the underlying Telnyx Call object and provides
reactive streams for all call state changes, making it easy to
integrate with any state management solution.

## Constructors

### Constructor

> **new Call**(`_telnyxCall`, `_callId`, `_destination`, `_isIncoming`, `isReattached`, `_originalCallerName?`, `_originalCallerNumber?`): `Call`

Defined in: [models/call.ts:23](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L23)

#### Parameters

##### \_telnyxCall

[`TelnyxCall`](../interfaces/TelnyxCall.md)

##### \_callId

`string`

##### \_destination

`string`

##### \_isIncoming

`boolean`

##### isReattached

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

Defined in: [models/call.ts:44](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L44)

Unique identifier for this call

##### Returns

`string`

***

### destination

#### Get Signature

> **get** **destination**(): `string`

Defined in: [models/call.ts:51](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L51)

The destination number or SIP URI

##### Returns

`string`

***

### isIncoming

#### Get Signature

> **get** **isIncoming**(): `boolean`

Defined in: [models/call.ts:58](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L58)

Whether this is an incoming call

##### Returns

`boolean`

***

### isOutgoing

#### Get Signature

> **get** **isOutgoing**(): `boolean`

Defined in: [models/call.ts:65](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L65)

Whether this is an outgoing call

##### Returns

`boolean`

***

### currentState

#### Get Signature

> **get** **currentState**(): [`TelnyxCallState`](../enumerations/TelnyxCallState.md)

Defined in: [models/call.ts:72](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L72)

Current call state (synchronous access)

##### Returns

[`TelnyxCallState`](../enumerations/TelnyxCallState.md)

***

### currentIsMuted

#### Get Signature

> **get** **currentIsMuted**(): `boolean`

Defined in: [models/call.ts:79](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L79)

Current mute state (synchronous access)

##### Returns

`boolean`

***

### currentIsHeld

#### Get Signature

> **get** **currentIsHeld**(): `boolean`

Defined in: [models/call.ts:86](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L86)

Current hold state (synchronous access)

##### Returns

`boolean`

***

### currentDuration

#### Get Signature

> **get** **currentDuration**(): `number`

Defined in: [models/call.ts:93](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L93)

Current call duration in seconds (synchronous access)

##### Returns

`number`

***

### inviteCustomHeaders

#### Get Signature

> **get** **inviteCustomHeaders**(): `object`[]

Defined in: [models/call.ts:102](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L102)

Custom headers received from the WebRTC INVITE message.
These headers are passed during call initiation and can contain application-specific information.
Format should be `[{"name": "X-Header-Name", "value": "Value"}]` where header names must start with "X-".

##### Returns

`object`[]

***

### answerCustomHeaders

#### Get Signature

> **get** **answerCustomHeaders**(): `object`[]

Defined in: [models/call.ts:111](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L111)

Custom headers received from the WebRTC ANSWER message.
These headers are passed during call acceptance and can contain application-specific information.
Format should be `[{"name": "X-Header-Name", "value": "Value"}]` where header names must start with "X-".

##### Returns

`object`[]

***

### telnyxCall

#### Get Signature

> **get** **telnyxCall**(): [`TelnyxCall`](../interfaces/TelnyxCall.md)

Defined in: [models/call.ts:119](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L119)

**`Internal`**

Get the underlying Telnyx Call object (for internal use)

##### Returns

[`TelnyxCall`](../interfaces/TelnyxCall.md)

***

### callState$

#### Get Signature

> **get** **callState$**(): `Observable`\<[`TelnyxCallState`](../enumerations/TelnyxCallState.md)\>

Defined in: [models/call.ts:126](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L126)

Observable stream of call state changes

##### Returns

`Observable`\<[`TelnyxCallState`](../enumerations/TelnyxCallState.md)\>

***

### isMuted$

#### Get Signature

> **get** **isMuted$**(): `Observable`\<`boolean`\>

Defined in: [models/call.ts:133](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L133)

Observable stream of mute state changes

##### Returns

`Observable`\<`boolean`\>

***

### isHeld$

#### Get Signature

> **get** **isHeld$**(): `Observable`\<`boolean`\>

Defined in: [models/call.ts:140](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L140)

Observable stream of hold state changes

##### Returns

`Observable`\<`boolean`\>

***

### duration$

#### Get Signature

> **get** **duration$**(): `Observable`\<`number`\>

Defined in: [models/call.ts:147](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L147)

Observable stream of call duration changes (in seconds)

##### Returns

`Observable`\<`number`\>

***

### canAnswer$

#### Get Signature

> **get** **canAnswer$**(): `Observable`\<`boolean`\>

Defined in: [models/call.ts:154](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L154)

Observable that emits true when the call can be answered

##### Returns

`Observable`\<`boolean`\>

***

### canHangup$

#### Get Signature

> **get** **canHangup$**(): `Observable`\<`boolean`\>

Defined in: [models/call.ts:164](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L164)

Observable that emits true when the call can be hung up

##### Returns

`Observable`\<`boolean`\>

***

### canHold$

#### Get Signature

> **get** **canHold$**(): `Observable`\<`boolean`\>

Defined in: [models/call.ts:174](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L174)

Observable that emits true when the call can be put on hold

##### Returns

`Observable`\<`boolean`\>

***

### canResume$

#### Get Signature

> **get** **canResume$**(): `Observable`\<`boolean`\>

Defined in: [models/call.ts:184](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L184)

Observable that emits true when the call can be resumed from hold

##### Returns

`Observable`\<`boolean`\>

## Methods

### answer()

> **answer**(`customHeaders?`): `Promise`\<`void`\>

Defined in: [models/call.ts:195](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L195)

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

Defined in: [models/call.ts:227](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L227)

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

Defined in: [models/call.ts:266](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L266)

Put the call on hold

#### Returns

`Promise`\<`void`\>

***

### resume()

> **resume**(): `Promise`\<`void`\>

Defined in: [models/call.ts:282](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L282)

Resume the call from hold

#### Returns

`Promise`\<`void`\>

***

### mute()

> **mute**(): `Promise`\<`void`\>

Defined in: [models/call.ts:298](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L298)

Mute the call

#### Returns

`Promise`\<`void`\>

***

### unmute()

> **unmute**(): `Promise`\<`void`\>

Defined in: [models/call.ts:315](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L315)

Unmute the call

#### Returns

`Promise`\<`void`\>

***

### toggleMute()

> **toggleMute**(): `Promise`\<`void`\>

Defined in: [models/call.ts:332](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L332)

Toggle mute state

#### Returns

`Promise`\<`void`\>

***

### setConnecting()

> **setConnecting**(): `void`

Defined in: [models/call.ts:344](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L344)

**`Internal`**

Set the call to connecting state (used for push notification calls when answered via CallKit)

#### Returns

`void`

***

### dispose()

> **dispose**(): `void`

Defined in: [models/call.ts:352](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call.ts#L352)

Clean up resources when the call is disposed

#### Returns

`void`
