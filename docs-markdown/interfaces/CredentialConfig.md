# Interface: CredentialConfig

Defined in: [models/config.ts:4](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/config.ts#L4)

Configuration for credential-based authentication

## Properties

### type

> **type**: `"credential"`

Defined in: [models/config.ts:5](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/config.ts#L5)

***

### sipUser

> **sipUser**: `string`

Defined in: [models/config.ts:6](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/config.ts#L6)

***

### sipPassword

> **sipPassword**: `string`

Defined in: [models/config.ts:7](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/config.ts#L7)

***

### debug?

> `optional` **debug**: `boolean`

Defined in: [models/config.ts:8](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/config.ts#L8)

Enable WebSocket-based debug stats collection. When enabled, the SDK sends real-time WebRTC statistics to the Telnyx debug service over the WebSocket connection. Default: `false`

***

### pushNotificationDeviceToken?

> `optional` **pushNotificationDeviceToken**: `string`

Defined in: [models/config.ts:9](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/config.ts#L9)

***

### enableCallReports?

> `optional` **enableCallReports**: `boolean`

Defined in: [models/config.ts:11](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/config.ts#L11)

Enable automatic call quality reporting. When enabled, the SDK collects WebRTC stats and structured logs during calls and POSTs them to the `/call_report` endpoint when calls end. Default: `true`

***

### callReportInterval?

> `optional` **callReportInterval**: `number`

Defined in: [models/config.ts:13](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/config.ts#L13)

Stats collection interval in seconds. Default: `5`

***

### callReportLogLevel?

> `optional` **callReportLogLevel**: `string`

Defined in: [models/config.ts:15](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/config.ts#L15)

Minimum log level to capture for call reports: `'debug'` | `'info'` | `'warn'` | `'error'`. Default: `'debug'`

***

### callReportMaxLogEntries?

> `optional` **callReportMaxLogEntries**: `number`

Defined in: [models/config.ts:17](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/config.ts#L17)

Maximum number of log entries to buffer per call. Default: `1000`
