# Interface: CredentialConfig

Defined in: [models/config.ts:4](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L4)

Configuration for credential-based authentication

## Properties

### type

> **type**: `"credential"`

Defined in: [models/config.ts:5](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L5)

***

### sipUser

> **sipUser**: `string`

Defined in: [models/config.ts:6](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L6)

***

### sipPassword

> **sipPassword**: `string`

Defined in: [models/config.ts:7](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L7)

***

### debug?

> `optional` **debug?**: `boolean`

Defined in: [models/config.ts:8](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L8)

***

### pushNotificationDeviceToken?

> `optional` **pushNotificationDeviceToken?**: `string`

Defined in: [models/config.ts:9](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L9)

***

### pushWhenActive?

> `optional` **pushWhenActive?**: `boolean`

Defined in: [models/config.ts:11](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L11)

Receive PushKit calls while the WebSocket session is active. Default: false

***

### enableMissedCallNotifications?

> `optional` **enableMissedCallNotifications?**: `boolean`

Defined in: [models/config.ts:13](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L13)

Enable native missed call push notifications. Default: false

***

### incomingCallRingtone?

> `optional` **incomingCallRingtone?**: `string`

Defined in: [models/config.ts:15](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L15)

Android only: name of a bundled `res/raw` ringtone (without its file extension). Falls back to the device ringtone.

***

### useTrickleIce?

> `optional` **useTrickleIce?**: `boolean`

Defined in: [models/config.ts:17](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L17)

Enable Trickle ICE. Default: false

***

### enableCallReports?

> `optional` **enableCallReports?**: `boolean`

Defined in: [models/config.ts:19](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L19)

Enable automatic call quality reporting. Default: true

***

### callReportInterval?

> `optional` **callReportInterval?**: `number`

Defined in: [models/config.ts:21](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L21)

Stats collection interval in seconds. Default: 5

***

### callReportLogLevel?

> `optional` **callReportLogLevel?**: `string`

Defined in: [models/config.ts:23](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L23)

Minimum log level for call reports: 'debug' | 'info' | 'warn' | 'error'. Default: 'debug'

***

### callReportMaxLogEntries?

> `optional` **callReportMaxLogEntries?**: `number`

Defined in: [models/config.ts:25](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L25)

Max log entries per call. Default: 1000
