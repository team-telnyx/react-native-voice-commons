# Class: TelnyxVoipClient

Defined in: [telnyx-voip-client.ts:46](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L46)

The main public interface for the react-voice-commons module.

This class serves as the Façade for the entire module, providing a simplified
API that completely hides the underlying complexity. It is the sole entry point
for developers using the react-voice-commons package.

The TelnyxVoipClient is designed to be state-management agnostic, exposing
all observable state via RxJS streams. This allows developers to integrate it
into their chosen state management solution naturally.

## Constructors

### Constructor

> **new TelnyxVoipClient**(`options?`): `TelnyxVoipClient`

Defined in: [telnyx-voip-client.ts:82](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L82)

Creates a new TelnyxVoipClient instance.

#### Parameters

##### options?

[`TelnyxVoipClientOptions`](../interfaces/TelnyxVoipClientOptions.md) = `{}`

Configuration options for the client

#### Returns

`TelnyxVoipClient`

## Accessors

### connectionState$

#### Get Signature

> **get** **connectionState$**(): `Observable`\<[`TelnyxConnectionState`](../enumerations/TelnyxConnectionState.md)\>

Defined in: [telnyx-voip-client.ts:123](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L123)

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

Defined in: [telnyx-voip-client.ts:134](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L134)

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

Defined in: [telnyx-voip-client.ts:145](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L145)

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

Defined in: [telnyx-voip-client.ts:154](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L154)

Current connection state (synchronous access).

##### Returns

[`TelnyxConnectionState`](../enumerations/TelnyxConnectionState.md)

***

### currentCalls

#### Get Signature

> **get** **currentCalls**(): [`Call`](Call.md)[]

Defined in: [telnyx-voip-client.ts:161](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L161)

Current list of calls (synchronous access).

##### Returns

[`Call`](Call.md)[]

***

### currentActiveCall

#### Get Signature

> **get** **currentActiveCall**(): [`Call`](Call.md)

Defined in: [telnyx-voip-client.ts:168](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L168)

Current active call (synchronous access).

##### Returns

[`Call`](Call.md)

***

### hasActiveCalls

#### Get Signature

> **get** **hasActiveCalls**(): `boolean`

Defined in: [telnyx-voip-client.ts:176](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L176)

Check if there are any active calls (not in ENDED or FAILED state).
Matches TelnyxRTC `hasActiveCalls` property for multi-call support.

##### Returns

`boolean`

***

### sessionId

#### Get Signature

> **get** **sessionId**(): `string`

Defined in: [telnyx-voip-client.ts:270](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L270)

Current session ID (UUID) for this connection.

##### Returns

`string`

***

### options

#### Get Signature

> **get** **options**(): `Required`\<[`TelnyxVoipClientOptions`](../interfaces/TelnyxVoipClientOptions.md)\>

Defined in: [telnyx-voip-client.ts:277](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L277)

Configuration options for this client instance.

##### Returns

`Required`\<[`TelnyxVoipClientOptions`](../interfaces/TelnyxVoipClientOptions.md)\>

## Methods

### isLaunchedFromPushNotification()

> `static` **isLaunchedFromPushNotification**(): `Promise`\<`boolean`\>

Defined in: [telnyx-voip-client.ts:63](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L63)

Check if the app was launched from a push notification.

Use this to avoid double-login on cold start. When true, the SDK will
handle login internally via the push notification flow, so you should
skip your normal auto-login.

#### Returns

`Promise`\<`boolean`\>

true if there is pending push notification data indicating a push-launched app

***

### getCall()

> **getCall**(`callId`): [`Call`](Call.md)

Defined in: [telnyx-voip-client.ts:198](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L198)

Access any active call tracked by the client.
A call will be accessible until it has ended (transitioned to the ENDED state).
This matches the TelnyxRTC `getCall(callId)` method for multi-call support.

#### Parameters

##### callId

`string`

The unique identifier of a call.

#### Returns

[`Call`](Call.md)

The Call object that matches the requested callId, or null if not found.

#### Example

```typescript
const call = voipClient.getCall('some-call-uuid');
if (call) {
  console.log('Call state:', call.currentState);
}
```

***

### setActiveCall()

> **setActiveCall**(`callId`): `void`

Defined in: [telnyx-voip-client.ts:206](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L206)

Explicitly set the active call for multi-call scenarios.

#### Parameters

##### callId

`string`

The ID of the call to mark as active

#### Returns

`void`

***

### clearActiveCall()

> **clearActiveCall**(): `void`

Defined in: [telnyx-voip-client.ts:214](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L214)

Clear the explicitly selected active call and return to default selection.

#### Returns

`void`

***

### swapCalls()

> **swapCalls**(`targetCallId`): `Promise`\<`void`\>

Defined in: [telnyx-voip-client.ts:225](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L225)

Swap the current active call with a held call.
On iOS this is coordinated through CallKit so native and SDK state stay aligned.

#### Parameters

##### targetCallId

`string`

ID of the held call to make active

#### Returns

`Promise`\<`void`\>

***

### login()

> **login**(`config`): `Promise`\<`void`\>

Defined in: [telnyx-voip-client.ts:292](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L292)

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

Defined in: [telnyx-voip-client.ts:326](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L326)

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

Defined in: [telnyx-voip-client.ts:357](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L357)

Disconnects from the Telnyx platform.

This method terminates the connection, ends any active calls, and
cleans up all related resources.

#### Returns

`Promise`\<`void`\>

***

### loginFromStoredConfig()

> **loginFromStoredConfig**(): `Promise`\<`boolean`\>

Defined in: [telnyx-voip-client.ts:377](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L377)

Attempts to reconnect using previously stored configuration.

This method is used for auto-reconnection scenarios where the app
comes back to the foreground and needs to restore the connection.

#### Returns

`Promise`\<`boolean`\>

Whether reconnection was successful.

***

### newCall()

> **newCall**(`destination`, `callerName?`, `callerNumber?`, `customHeaders?`): `Promise`\<[`Call`](Call.md)\>

Defined in: [telnyx-voip-client.ts:476](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L476)

Initiates a new outgoing call.

#### Parameters

##### destination

`string`

The destination number or SIP URI to call

##### callerName?

`string`

Optional caller name to display

##### callerNumber?

`string`

Optional caller ID number

##### customHeaders?

`CustomHeaders`

Optional custom headers to include with the call

#### Returns

`Promise`\<[`Call`](Call.md)\>

A Promise that completes with the Call object once the invitation has been sent

The call's state can be monitored through the returned Call object's streams.

***

### handlePushNotification()

> **handlePushNotification**(`payload`): `Promise`\<`void`\>

Defined in: [telnyx-voip-client.ts:515](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L515)

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

Defined in: [telnyx-voip-client.ts:543](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L543)

Disables push notifications for the current session.

This method sends a request to the Telnyx backend to disable push
notifications for the current registered device/session.

#### Returns

`void`

***

### setCallConnecting()

> **setCallConnecting**(`callId`): `void`

Defined in: [telnyx-voip-client.ts:560](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L560)

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

Defined in: [telnyx-voip-client.ts:569](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L569)

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

> **queueAnswerFromCallKit**(`callKitUUIDOrHeaders?`, `customHeaders?`): `void`

Defined in: [telnyx-voip-client.ts:578](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L578)

Queue an answer action for when the call invite arrives (for CallKit integration)
This should be called when the user answers from CallKit before the socket connection is established

#### Parameters

##### callKitUUIDOrHeaders?

`string` \| `Record`\<`string`, `string`\>

##### customHeaders?

`Record`\<`string`, `string`\> = `{}`

Optional custom headers to include with the answer

#### Returns

`void`

***

### queueEndFromCallKit()

> **queueEndFromCallKit**(`callKitUUID?`): `void`

Defined in: [telnyx-voip-client.ts:614](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L614)

Queue an end action for when the call invite arrives (for CallKit integration)
This should be called when the user ends from CallKit before the socket connection is established

#### Parameters

##### callKitUUID?

`string`

#### Returns

`void`

***

### setPushNotificationCallKitUUID()

> **setPushNotificationCallKitUUID**(`callKitUUID`): `void`

Defined in: [telnyx-voip-client.ts:636](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L636)

**`Internal`**

Associate the next push-delivered INVITE with its app-facing CallKit UUID.
The underlying signaling call ID remains unchanged.

#### Parameters

##### callKitUUID

`string`

#### Returns

`void`

***

### dispose()

> **dispose**(): `Promise`\<`void`\>

Defined in: [telnyx-voip-client.ts:655](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L655)

Dispose of the client and clean up all resources.

After calling this method, the client instance should not be used anymore.
This is particularly important for background clients that should be
disposed after handling push notifications.

#### Returns

`Promise`\<`void`\>
