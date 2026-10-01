# Interface: TokenConfig

Defined in: [models/config.ts:31](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L31)

Configuration for token-based authentication

## Properties

### type

> **type**: `"token"`

Defined in: [models/config.ts:32](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L32)

***

### token

> **token**: `string`

Defined in: [models/config.ts:33](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L33)

***

### debug?

> `optional` **debug?**: `boolean`

Defined in: [models/config.ts:34](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L34)

***

### pushNotificationDeviceToken?

> `optional` **pushNotificationDeviceToken?**: `string`

Defined in: [models/config.ts:35](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L35)

***

### pushWhenActive?

> `optional` **pushWhenActive?**: `boolean`

Defined in: [models/config.ts:37](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L37)

Receive PushKit calls while the WebSocket session is active. Default: false

***

### enableMissedCallNotifications?

> `optional` **enableMissedCallNotifications?**: `boolean`

Defined in: [models/config.ts:39](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L39)

Enable native missed call push notifications. Default: false

***

### incomingCallRingtone?

> `optional` **incomingCallRingtone?**: `string`

Defined in: [models/config.ts:41](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L41)

Android only: name of a bundled `res/raw` ringtone (without its file extension). Falls back to the device ringtone.

***

### useTrickleIce?

> `optional` **useTrickleIce?**: `boolean`

Defined in: [models/config.ts:43](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L43)

Enable Trickle ICE. Default: false

***

### enableCallReports?

> `optional` **enableCallReports?**: `boolean`

Defined in: [models/config.ts:45](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L45)

Enable automatic call quality reporting. Default: true

***

### callReportInterval?

> `optional` **callReportInterval?**: `number`

Defined in: [models/config.ts:47](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L47)

Stats collection interval in seconds. Default: 5

***

### callReportLogLevel?

> `optional` **callReportLogLevel?**: `string`

Defined in: [models/config.ts:49](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L49)

Minimum log level for call reports: 'debug' | 'info' | 'warn' | 'error'. Default: 'debug'

***

### callReportMaxLogEntries?

> `optional` **callReportMaxLogEntries?**: `number`

Defined in: [models/config.ts:51](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L51)

Max log entries per call. Default: 1000
