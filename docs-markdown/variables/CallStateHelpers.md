# Variable: CallStateHelpers

> `const` **CallStateHelpers**: `object`

Defined in: [models/call-state.ts:40](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call-state.ts#L40)

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
