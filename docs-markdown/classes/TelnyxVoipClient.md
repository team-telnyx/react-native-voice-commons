
# Class: TelnyxVoipClient

Defined in: [telnyx-voip-client.ts:30](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/telnyx-voip-client.ts#L30)

The main public interface for the react-voice-commons module.

This class serves as the Façade for the entire module, providing a simplified
API that completely hides the underlying complexity. It is the sole entry point
for developers using the react-voice-commons package.

The TelnyxVoipClient is designed to be state-management agnostic, exposing
all observable state via RxJS streams. This allows developers to integrate it
into their chosen state management solution naturally.

## Constructors

### Constructor

> **new TelnyxVoipClient**(`options`): `TelnyxVoipClient`

Defined in: [telnyx-voip-client.ts:41](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/telnyx-voip-client.ts#L41)

Creates a new TelnyxVoipClient instance.

#### Parameters

##### options

[`TelnyxVoipClientOptions`](../interfaces/TelnyxVoipClientOptions.md) = `{}`

Configuration options for the client

#### Returns

`TelnyxVoipClient`

## Accessors

### connectionState$

#### Get Signature

> **get** **connectionState$**(): `Observable`\<[`TelnyxConnectionState`](../enumerations/TelnyxConnectionState.md)\>

Defined in: [telnyx-voip-client.ts:74](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/telnyx-voip-client.ts#L74)

Stream of connection state changes.

Emits the current status of the connection to the Telnyx backend.
Values include connecting, connected, disconnected, and error states.
Listen to this to show connection indicators in your UI.

##### Returns

`Observable`\<[`TelnyxConnectionState`](../enumerations/TelnyxConnectionState.md)\>

***

### calls$

#### Get Signature

> **get** **calls$**(): `Observable`\<[`Call`](Call.md)[]\>

Defined in: [telnyx-voip-client.ts:85](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/telnyx-voip-client.ts#L85)

Stream of all current calls.

Emits a list of all current Call objects. Use this for applications
that need to support multiple simultaneous calls (e.g., call waiting,
conference calls).

##### Returns

`Observable`\<[`Call`](Call.md)[]\>

***

### activeCall$

#### Get Signature

> **get** **activeCall$**(): `Observable`\<[`Call`](Call.md)\>

Defined in: [telnyx-voip-client.ts:96](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/telnyx-voip-client.ts#L96)

Stream of the currently active call.

A convenience stream that emits the currently active Call object.
It emits null when no call is in progress. Ideal for applications
that only handle a single call at a time.

##### Returns

`Observable`\<[`Call`](Call.md)\>

***

### currentConnectionState

#### Get Signature

> **get** **currentConnectionState**(): [`TelnyxConnectionState`](../enumerations/TelnyxConnectionState.md)

Defined in: [telnyx-voip-client.ts:105](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/telnyx-voip-client.ts#L105)

Current connection state (synchronous access).

##### Returns

[`TelnyxConnectionState`](../enumerations/TelnyxConnectionState.md)

***

### currentCalls

#### Get Signature

> **get** **currentCalls**(): [`Call`](Call.md)[]

Defined in: [telnyx-voip-client.ts:112](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/telnyx-voip-client.ts#L112)

Current list of calls (synchronous access).

##### Returns

[`Call`](Call.md)[]

***

### currentActiveCall

#### Get Signature

> **get** **currentActiveCall**(): [`Call`](Call.md)

Defined in: [telnyx-voip-client.ts:119](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/telnyx-voip-client.ts#L119)

Current active call (synchronous access).

##### Returns

[`Call`](Call.md)

***

### sessionId

#### Get Signature

> **get** **sessionId**(): `string`

Defined in: [telnyx-voip-client.ts:126](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/telnyx-voip-client.ts#L126)

Current session ID (UUID) for this connection.

##### Returns

`string`

***

### options

#### Get Signature

> **get** **options**(): `Required`\<[`TelnyxVoipClientOptions`](../interfaces/TelnyxVoipClientOptions.md)\>

Defined in: [telnyx-voip-client.ts:133](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/telnyx-voip-client.ts#L133)

Configuration options for this client instance.

##### Returns

`Required`\<[`TelnyxVoipClientOptions`](../interfaces/TelnyxVoipClientOptions.md)\>

## Methods

### login()

> **login**(`config`): `Promise`\<`void`\>

Defined in: [telnyx-voip-client.ts:148](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/telnyx-voip-client.ts#L148)

Connects to the Telnyx platform using credential authentication.

#### Parameters

##### config

[`CredentialConfig`](../interfaces/CredentialConfig.md)

The credential configuration containing SIP username and password

#### Returns

`Promise`\<`void`\>

A Promise that completes when the connection attempt is initiated

Listen to connectionState$ to monitor the actual connection status.
Credentials are automatically stored for future reconnection.

***

### loginWithToken()

> **loginWithToken**(`config`): `Promise`\<`void`\>

Defined in: [telnyx-voip-client.ts:175](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/telnyx-voip-client.ts#L175)

Connects to the Telnyx platform using token authentication.

#### Parameters

##### config

[`TokenConfig`](../interfaces/TokenConfig.md)

The token configuration containing the authentication token

#### Returns

`Promise`\<`void`\>

A Promise that completes when the connection attempt is initiated

Listen to connectionState$ to monitor the actual connection status.
Token is automatically stored for future reconnection.

***

### logout()

> **logout**(): `Promise`\<`void`\>

Defined in: [telnyx-voip-client.ts:199](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/telnyx-voip-client.ts#L199)

Disconnects from the Telnyx platform.

This method terminates the connection, ends any active calls, and
cleans up all related resources.

#### Returns

`Promise`\<`void`\>

***

### loginFromStoredConfig()

> **loginFromStoredConfig**(): `Promise`\<`boolean`\>

Defined in: [telnyx-voip-client.ts:219](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/telnyx-voip-client.ts#L219)

Attempts to reconnect using previously stored configuration.

This method is used for auto-reconnection scenarios where the app
comes back to the foreground and needs to restore the connection.

#### Returns

`Promise`\<`boolean`\>

Promise<boolean> - true if reconnection was successful, false otherwise

***

### newCall()

> **newCall**(`destination`, `debug`): `Promise`\<[`Call`](Call.md)\>

Defined in: [telnyx-voip-client.ts:294](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/telnyx-voip-client.ts#L294)

Initiates a new outgoing call.

#### Parameters

##### destination

`string`

The destination number or SIP URI to call

##### debug

`boolean` = `false`

Optional flag to enable call quality metrics for this call

#### Returns

`Promise`\<[`Call`](Call.md)\>

A Promise that completes with the Call object once the invitation has been sent

The call's state can be monitored through the returned Call object's streams.

***

### handlePushNotification()

> **handlePushNotification**(`payload`): `Promise`\<`void`\>

Defined in: [telnyx-voip-client.ts:323](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/telnyx-voip-client.ts#L323)

Handle push notification payload.

This is the unified entry point for all push notifications. It intelligently
determines whether to show a new incoming call UI or to process an already
actioned (accepted/declined) call upon app launch.

#### Parameters

##### payload

`Record`\<`string`, `any`\>

The push notification payload

#### Returns

`Promise`\<`void`\>

***

### disablePushNotifications()

> **disablePushNotifications**(): `void`

Defined in: [telnyx-voip-client.ts:359](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/telnyx-voip-client.ts#L359)

Disables push notifications for the current session.

This method sends a request to the Telnyx backend to disable push
notifications for the current registered device/session.

#### Returns

`void`

***

### setCallConnecting()

> **setCallConnecting**(`callId`): `void`

Defined in: [telnyx-voip-client.ts:376](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/telnyx-voip-client.ts#L376)

**`Internal`**

Set a call to connecting state (used for push notification calls when answered via CallKit)

#### Parameters

##### callId

`string`

The ID of the call to set to connecting state

#### Returns

`void`

***

### findCallByTelnyxCall()

> **findCallByTelnyxCall**(`telnyxCall`): [`Call`](Call.md)

Defined in: [telnyx-voip-client.ts:385](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/telnyx-voip-client.ts#L385)

**`Internal`**

Find a call by its underlying Telnyx call object

#### Parameters

##### telnyxCall

`any`

The Telnyx call object to find

#### Returns

[`Call`](Call.md)

***

### queueAnswerFromCallKit()

> **queueAnswerFromCallKit**(`customHeaders`): `void`

Defined in: [telnyx-voip-client.ts:394](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/telnyx-voip-client.ts#L394)

Queue an answer action for when the call invite arrives (for CallKit integration)
This should be called when the user answers from CallKit before the socket connection is established

#### Parameters

##### customHeaders

`Record`\<`string`, `string`\> = `{}`

Optional custom headers to include with the answer

#### Returns

`void`

***

### queueEndFromCallKit()

> **queueEndFromCallKit**(): `void`

Defined in: [telnyx-voip-client.ts:415](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/telnyx-voip-client.ts#L415)

Queue an end action for when the call invite arrives (for CallKit integration)
This should be called when the user ends from CallKit before the socket connection is established

#### Returns

`void`

***

### dispose()

> **dispose**(): `void`

Defined in: [telnyx-voip-client.ts:441](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/telnyx-voip-client.ts#L441)

Dispose of the client and clean up all resources.

After calling this method, the client instance should not be used anymore.
This is particularly important for background clients that should be
disposed after handling push notifications.

#### Returns

`void`
