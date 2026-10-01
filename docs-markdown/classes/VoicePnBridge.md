# Class: VoicePnBridge

Defined in: [internal/voice-pn-bridge.ts:57](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/internal/voice-pn-bridge.ts#L57)

Enhanced VoicePnBridge with call control and event handling capabilities

## Constructors

### Constructor

> **new VoicePnBridge**(): `VoicePnBridge`

#### Returns

`VoicePnBridge`

## Methods

### getPendingPushAction()

> `static` **getPendingPushAction**(): `Promise`\<\{ `action?`: `string`; `metadata?`: `string`; \}\>

Defined in: [internal/voice-pn-bridge.ts:61](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/internal/voice-pn-bridge.ts#L61)

Get any pending push notification action from native side

#### Returns

`Promise`\<\{ `action?`: `string`; `metadata?`: `string`; \}\>

***

### setPendingPushAction()

> `static` **setPendingPushAction**(`action`, `metadata`): `Promise`\<`boolean`\>

Defined in: [internal/voice-pn-bridge.ts:77](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/internal/voice-pn-bridge.ts#L77)

Set a pending push notification action to native side

#### Parameters

##### action

`string`

##### metadata

`string`

#### Returns

`Promise`\<`boolean`\>

***

### getPendingCallAction()

> `static` **getPendingCallAction**(): `Promise`\<\{ `action?`: `string`; `callId?`: `string`; `timestamp?`: `number`; \}\>

Defined in: [internal/voice-pn-bridge.ts:89](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/internal/voice-pn-bridge.ts#L89)

Get any pending call action from native side (reliable polling pattern)

#### Returns

`Promise`\<\{ `action?`: `string`; `callId?`: `string`; `timestamp?`: `number`; \}\>

***

### clearPendingCallAction()

> `static` **clearPendingCallAction**(): `Promise`\<`boolean`\>

Defined in: [internal/voice-pn-bridge.ts:110](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/internal/voice-pn-bridge.ts#L110)

Clear any pending call action

#### Returns

`Promise`\<`boolean`\>

***

### clearPendingPushAction()

> `static` **clearPendingPushAction**(): `Promise`\<`boolean`\>

Defined in: [internal/voice-pn-bridge.ts:122](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/internal/voice-pn-bridge.ts#L122)

Clear any pending push notification action

#### Returns

`Promise`\<`boolean`\>

***

### endCall()

> `static` **endCall**(`callId?`): `Promise`\<`boolean`\>

Defined in: [internal/voice-pn-bridge.ts:135](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/internal/voice-pn-bridge.ts#L135)

React Native → Android: End/hang up the current call
This will hide the ongoing call notification and notify the native side

#### Parameters

##### callId?

`string`

#### Returns

`Promise`\<`boolean`\>

***

### showOngoingCallNotification()

> `static` **showOngoingCallNotification**(`callerName?`, `callerNumber?`, `callId?`): `Promise`\<`boolean`\>

Defined in: [internal/voice-pn-bridge.ts:148](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/internal/voice-pn-bridge.ts#L148)

React Native → Android: Show ongoing call notification to keep app alive
Should be called when a call becomes active to prevent background termination

#### Parameters

##### callerName?

`string`

##### callerNumber?

`string`

##### callId?

`string`

#### Returns

`Promise`\<`boolean`\>

***

### hideOngoingCallNotification()

> `static` **hideOngoingCallNotification**(): `Promise`\<`boolean`\>

Defined in: [internal/voice-pn-bridge.ts:169](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/internal/voice-pn-bridge.ts#L169)

React Native → Android: Hide ongoing call notification
Should be called when a call ends to clean up notifications

#### Returns

`Promise`\<`boolean`\>

***

### hideIncomingCallNotification()

> `static` **hideIncomingCallNotification**(): `Promise`\<`boolean`\>

Defined in: [internal/voice-pn-bridge.ts:182](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/internal/voice-pn-bridge.ts#L182)

React Native → Android: Hide incoming call notification
Useful for dismissing notifications when call is answered/rejected in app

#### Returns

`Promise`\<`boolean`\>

***

### setIncomingCallRingtone()

> `static` **setIncomingCallRingtone**(`resourceName?`): `Promise`\<`boolean`\>

Defined in: [internal/voice-pn-bridge.ts:195](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/internal/voice-pn-bridge.ts#L195)

Configure Android's incoming-call ringtone using an app resource in `res/raw`.
Pass no value to use the device's default phone ringtone.

#### Parameters

##### resourceName?

`string`

#### Returns

`Promise`\<`boolean`\>

***

### getPendingCallKitAnswer()

> `static` **getPendingCallKitAnswer**(): `Promise`\<`string`\>

Defined in: [internal/voice-pn-bridge.ts:210](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/internal/voice-pn-bridge.ts#L210)

Get pending CallKit answer UUID from native storage (iOS only).
When the user answers a CallKit call before JS listeners are ready,
the native side persists the answer UUID in UserDefaults so JS can detect it.

#### Returns

`Promise`\<`string`\>

***

### clearPendingCallKitAnswer()

> `static` **clearPendingCallKitAnswer**(): `Promise`\<`boolean`\>

Defined in: [internal/voice-pn-bridge.ts:223](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/internal/voice-pn-bridge.ts#L223)

Clear pending CallKit answer from native storage (iOS only)

#### Returns

`Promise`\<`boolean`\>

***

### getVoipToken()

> `static` **getVoipToken**(): `Promise`\<`string`\>

Defined in: [internal/voice-pn-bridge.ts:236](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/internal/voice-pn-bridge.ts#L236)

Get VoIP token from native storage

#### Returns

`Promise`\<`string`\>

***

### getPendingVoipPush()

> `static` **getPendingVoipPush**(): `Promise`\<`string`\>

Defined in: [internal/voice-pn-bridge.ts:249](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/internal/voice-pn-bridge.ts#L249)

Get pending VoIP push from native storage (iOS only)

#### Returns

`Promise`\<`string`\>

***

### clearPendingVoipPush()

> `static` **clearPendingVoipPush**(): `Promise`\<`boolean`\>

Defined in: [internal/voice-pn-bridge.ts:262](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/internal/voice-pn-bridge.ts#L262)

Clear pending VoIP push from native storage (iOS only)

#### Returns

`Promise`\<`boolean`\>

***

### getPendingVoipAction()

> `static` **getPendingVoipAction**(): `Promise`\<`string`\>

Defined in: [internal/voice-pn-bridge.ts:275](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/internal/voice-pn-bridge.ts#L275)

Get pending VoIP action from native storage (iOS only)

#### Returns

`Promise`\<`string`\>

***

### clearPendingVoipAction()

> `static` **clearPendingVoipAction**(): `Promise`\<`boolean`\>

Defined in: [internal/voice-pn-bridge.ts:288](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/internal/voice-pn-bridge.ts#L288)

Clear pending VoIP action from native storage (iOS only)

#### Returns

`Promise`\<`boolean`\>

***

### setMissedCallNotificationsEnabled()

> `static` **setMissedCallNotificationsEnabled**(`enabled`): `Promise`\<`boolean`\>

Defined in: [internal/voice-pn-bridge.ts:302](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/internal/voice-pn-bridge.ts#L302)

Enable or disable local missed call notifications on iOS.
Missed-call VoIP pushes are still handled through CallKit either way.

#### Parameters

##### enabled

`boolean`

#### Returns

`Promise`\<`boolean`\>

***

### getMissedCallNotificationsEnabled()

> `static` **getMissedCallNotificationsEnabled**(): `Promise`\<`boolean`\>

Defined in: [internal/voice-pn-bridge.ts:314](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/internal/voice-pn-bridge.ts#L314)

Returns true by default, matching the sample-app behavior for missed calls.

#### Returns

`Promise`\<`boolean`\>

***

### setSpeakerEnabled()

> `static` **setSpeakerEnabled**(`enabled`): `Promise`\<`boolean`\>

Defined in: [internal/voice-pn-bridge.ts:327](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/internal/voice-pn-bridge.ts#L327)

Route call audio through the loudspeaker when enabled, or back to the
platform default voice route when disabled.

#### Parameters

##### enabled

`boolean`

#### Returns

`Promise`\<`boolean`\>

***

### isSpeakerEnabled()

> `static` **isSpeakerEnabled**(): `Promise`\<`boolean`\>

Defined in: [internal/voice-pn-bridge.ts:339](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/internal/voice-pn-bridge.ts#L339)

Returns whether the current audio route is using the loudspeaker.

#### Returns

`Promise`\<`boolean`\>

***

### toggleSpeaker()

> `static` **toggleSpeaker**(): `Promise`\<`boolean`\>

Defined in: [internal/voice-pn-bridge.ts:351](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/internal/voice-pn-bridge.ts#L351)

Toggle between loudspeaker and the platform default voice route.

#### Returns

`Promise`\<`boolean`\>

***

### addCallActionListener()

> `static` **addCallActionListener**(`listener`): `EmitterSubscription`

Defined in: [internal/voice-pn-bridge.ts:362](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/internal/voice-pn-bridge.ts#L362)

Android → React Native: Listen for immediate call action events from notification buttons
Use this for active calls where immediate response is needed (e.g., ending ongoing calls)

#### Parameters

##### listener

(`event`) => `void`

#### Returns

`EmitterSubscription`

***

### removeCallActionListener()

> `static` **removeCallActionListener**(`subscription`): `void`

Defined in: [internal/voice-pn-bridge.ts:369](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/internal/voice-pn-bridge.ts#L369)

Remove call action listener

#### Parameters

##### subscription

`EmitterSubscription`

#### Returns

`void`

***

### removeAllCallActionListeners()

> `static` **removeAllCallActionListeners**(): `void`

Defined in: [internal/voice-pn-bridge.ts:376](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/internal/voice-pn-bridge.ts#L376)

Remove all call action listeners

#### Returns

`void`
