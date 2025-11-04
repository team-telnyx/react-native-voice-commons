[**@telnyx/react-voice-commons-sdk v0.1.2**](../README.md)

***

[@telnyx/react-voice-commons-sdk](../globals.md) / CallStateHelpers

# Variable: CallStateHelpers

> `const` **CallStateHelpers**: `object`

Defined in: [models/call-state.ts:37](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/call-state.ts#L37)

Helper functions to determine what actions are available in each state

## Type Declaration

### canAnswer()

> **canAnswer**(`state`): `boolean`

Can the call be answered in this state?

#### Parameters

##### state

[`TelnyxCallState`](../enumerations/TelnyxCallState.md)

#### Returns

`boolean`

### canHangup()

> **canHangup**(`state`): `boolean`

Can the call be hung up in this state?

#### Parameters

##### state

[`TelnyxCallState`](../enumerations/TelnyxCallState.md)

#### Returns

`boolean`

### canHold()

> **canHold**(`state`): `boolean`

Can the call be put on hold in this state?

#### Parameters

##### state

[`TelnyxCallState`](../enumerations/TelnyxCallState.md)

#### Returns

`boolean`

### canResume()

> **canResume**(`state`): `boolean`

Can the call be resumed from hold in this state?

#### Parameters

##### state

[`TelnyxCallState`](../enumerations/TelnyxCallState.md)

#### Returns

`boolean`

### canToggleMute()

> **canToggleMute**(`state`): `boolean`

Can the call be muted/unmuted in this state?

#### Parameters

##### state

[`TelnyxCallState`](../enumerations/TelnyxCallState.md)

#### Returns

`boolean`

### isTerminated()

> **isTerminated**(`state`): `boolean`

Is the call in a terminated state?

#### Parameters

##### state

[`TelnyxCallState`](../enumerations/TelnyxCallState.md)

#### Returns

`boolean`

### isActive()

> **isActive**(`state`): `boolean`

Is the call in an active state (can have media)?

#### Parameters

##### state

[`TelnyxCallState`](../enumerations/TelnyxCallState.md)

#### Returns

`boolean`

### isConnecting()

> **isConnecting**(`state`): `boolean`

Is the call in a connecting state (answered but not yet active)?

#### Parameters

##### state

[`TelnyxCallState`](../enumerations/TelnyxCallState.md)

#### Returns

`boolean`
