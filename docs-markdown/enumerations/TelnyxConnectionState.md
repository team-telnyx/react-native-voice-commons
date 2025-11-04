[**@telnyx/react-voice-commons-sdk v0.1.2**](../README.md)

***

[@telnyx/react-voice-commons-sdk](../globals.md) / TelnyxConnectionState

# Enumeration: TelnyxConnectionState

Defined in: [models/connection-state.ts:7](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/connection-state.ts#L7)

Represents the connection state to the Telnyx platform.

This enum provides a simplified view of the connection status,
abstracting away the complexity of the underlying WebSocket states.

## Enumeration Members

### DISCONNECTED

> **DISCONNECTED**: `"DISCONNECTED"`

Defined in: [models/connection-state.ts:9](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/connection-state.ts#L9)

Initial state before any connection attempt

***

### CONNECTING

> **CONNECTING**: `"CONNECTING"`

Defined in: [models/connection-state.ts:12](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/connection-state.ts#L12)

Attempting to establish connection

***

### CONNECTED

> **CONNECTED**: `"CONNECTED"`

Defined in: [models/connection-state.ts:15](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/connection-state.ts#L15)

Successfully connected and authenticated

***

### RECONNECTING

> **RECONNECTING**: `"RECONNECTING"`

Defined in: [models/connection-state.ts:18](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/connection-state.ts#L18)

Connection lost, attempting to reconnect

***

### ERROR

> **ERROR**: `"ERROR"`

Defined in: [models/connection-state.ts:21](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/connection-state.ts#L21)

Connection failed or authentication error
