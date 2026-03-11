# Interface: TokenConfig

Defined in: [models/config.ts:15](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/config.ts#L15)

Configuration for token-based authentication

## Properties

### type

> **type**: `"token"`

Defined in: [models/config.ts:16](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/config.ts#L16)

***

### token

> **token**: `string`

Defined in: [models/config.ts:17](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/config.ts#L17)

***

### debug?

> `optional` **debug**: `boolean`

Defined in: [models/config.ts:18](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/config.ts#L18)

Enable WebSocket-based debug stats collection. When enabled, the SDK sends real-time WebRTC statistics to the Telnyx debug service over the WebSocket connection. Default: `false`

***

### pushNotificationDeviceToken?

> `optional` **pushNotificationDeviceToken**: `string`

Defined in: [models/config.ts:19](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/config.ts#L19)

***

### enableCallReports?

> `optional` **enableCallReports**: `boolean`

Defined in: [models/config.ts:29](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/config.ts#L29)

Enable automatic call quality reporting. When enabled, the SDK collects WebRTC stats and structured logs during calls and POSTs them to the `/call_report` endpoint when calls end. Default: `true`

***

### callReportInterval?

> `optional` **callReportInterval**: `number`

Defined in: [models/config.ts:31](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/config.ts#L31)

Stats collection interval in seconds. Default: `5`

***

### callReportLogLevel?

> `optional` **callReportLogLevel**: `string`

Defined in: [models/config.ts:33](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/config.ts#L33)

Minimum log level to capture for call reports: `'debug'` | `'info'` | `'warn'` | `'error'`. Default: `'debug'`

***

### callReportMaxLogEntries?

> `optional` **callReportMaxLogEntries**: `number`

Defined in: [models/config.ts:35](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/config.ts#L35)

Maximum number of log entries to buffer per call. Default: `1000`
