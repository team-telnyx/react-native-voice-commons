# CHANGELOG.md

## [0.4.2](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/voice-sdk-v0.4.2) (2026-04-01)

### Enhancement

- Switch to npm trusted publishing with OIDC (no stored secrets)

## [0.4.1](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/voice-sdk-v0.4.1) (2026-03-31)

### Bug Fixing

- Fixed push notification flags not being reset after call action execution, causing subsequent calls to be auto-answered
- Added local network permissions for iOS demo app

## [0.4.0](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/sdk-0.4.0) (2026-03-19)

### Breaking Changes

- Removed JSON-RPC ACK messages (invite, answer, ringing) to match Android SDK behavior

### Enhancement

- Standardized User-Agent to `ReactNative-{version}` across all WebSocket messages (login, invite, answer, attach)
- Added `sdkVersion` client option to allow parent SDKs to propagate their version downstream
- Added call quality reporting infrastructure (`CallReportCollector`, `LogCollector`) with configurable intervals and log levels
- Added `enableCallReports` client option for automatic call quality reporting (disabled by default)
- Wrapped `createInboundCall` in try/catch for better error visibility

### Bug Fixing

- Fixed `telnyxCallControlId` not being destructured in `createInboundCall`, causing a ReferenceError on inbound calls
- Fixed login reconnection config key checks (`loginToken` -> `login_token`, `sipUser` -> `login`)

## [0.3.0](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/sdk-0.3.0) (2025-12-08)

### Enhancement

• Comprehensive media events implementation for advanced call handling
• Enhanced early media and ringback support for incoming calls
• Improved media event handling with SDP management
• Real-time audio/video media updates during calls
• Better call state management with media event integration
• Enhanced push notification support with CallKit UUID management
• Improved network reconnection handling for VoIP calls
• Advanced call attachment and reattachment logic
• Better logging and debugging capabilities for media events

### Bug Fixing

• Fixed media event processing race conditions
• Improved call ID matching for media events
• Enhanced error handling for network disconnections
• Fixed SDP handling for early media scenarios

## [0.2.0](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/sdk-0.2.0) (2025-11-20)

### Enhancement

• Core WebRTC voice calling functionality
• Call management (invite, answer, hangup)
• Push notification integration
• Network reconnection logic
• Session management
• Basic media handling
