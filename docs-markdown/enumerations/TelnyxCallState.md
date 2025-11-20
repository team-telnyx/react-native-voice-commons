# Enumeration: TelnyxCallState

Defined in: [models/call-state.ts:7](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call-state.ts#L7)

Represents the state of a call in the Telnyx system.

This enum provides a simplified view of call states, abstracting away
the complexity of the underlying SIP call states.

## Enumeration Members

### RINGING

> **RINGING**: `"RINGING"`

Defined in: [models/call-state.ts:9](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call-state.ts#L9)

Call is being initiated (outgoing) or received (incoming)

***

### CONNECTING

> **CONNECTING**: `"CONNECTING"`

Defined in: [models/call-state.ts:12](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call-state.ts#L12)

Call is connecting after being answered (usually from push notification)

***

### ACTIVE

> **ACTIVE**: `"ACTIVE"`

Defined in: [models/call-state.ts:15](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call-state.ts#L15)

Call has been answered and media is flowing

***

### HELD

> **HELD**: `"HELD"`

Defined in: [models/call-state.ts:18](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call-state.ts#L18)

Call is on hold

***

### ENDED

> **ENDED**: `"ENDED"`

Defined in: [models/call-state.ts:21](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call-state.ts#L21)

Call has ended normally

***

### FAILED

> **FAILED**: `"FAILED"`

Defined in: [models/call-state.ts:24](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call-state.ts#L24)

Call failed to connect or was rejected

***

### DROPPED

> **DROPPED**: `"DROPPED"`

Defined in: [models/call-state.ts:27](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/call-state.ts#L27)

Call was dropped due to network issues
