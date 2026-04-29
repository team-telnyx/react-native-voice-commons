# CHANGELOG.md

## [0.4.5-beta.0](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/voice-sdk-v0.4.5-beta.0) (2026-04-30)

### Bug Fixing

- **Removed automatic socket-level reconnect on `telnyx.socket.error` / `telnyx.socket.close`.** This auto-reconnect path (added in 0.4.3) created a multi-instance race when consumers (e.g. `@telnyx/react-voice-commons-sdk`) rebuild a `TelnyxRTC` on each VoIP push: the prior client's `setTimeout`-scheduled reconnect would fire after disposal and open a parallel session with the previous push's `voice_sdk_id`, causing the gateway to deliver the new INVITE elsewhere and `punt` the parallel session — dropping the active call. Mid-call network changes are still handled by the existing `NetInfo`-driven `onNetworkUnavailable` / `attemptReconnection` path. Socket error/close after login are now logged but do not auto-reconnect; the consumer is responsible for the recovery decision.
- **`disconnect()` now unconditionally clears `reconnecting` when called externally** (`fromReconnection=false`). Previously a client whose `reconnecting` flag was set could keep that flag through external disposal, leaving a window where a subsequent call to `attemptReconnection` would re-enter the reconnect path on a disposed instance.

## [0.4.4](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/voice-sdk-v0.4.4) (2026-04-27)

### Bug Fixing

- **`Call.dtmf()` now sends a full `dialogParams` object on the `telnyx_rtc.info` request to match the Android Voice SDK.** Previously only `{ sessid, dtmf }` was sent. The new payload mirrors Android exactly — `attach`, `audio`, `callID`, `caller_id_name`, `caller_id_number`, `clientState`, `custom_headers`, `destination_number`, `remote_caller_id_name`, `screenShare`, `useStereo`, `userVariables`, `video` — populated from the call's `CallOptions` where available and empty-but-present defaults (`""`, `[]`, `false`) for fields we don't track. Fields not represented in `CallOptions` (`screenShare`, `useStereo`, `userVariables`, `video`) are always sent as their Android-equivalent defaults.

## [0.4.3](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/voice-sdk-v0.4.3) (2026-04-27)

### Bug Fixing

- **Recover from stale WebSocket after iOS app freeze.** `Connection` now stamps `lastActivityAt` on open / successful send / receive and exposes it via `Connection.idleMs`. `TelnyxRTC.isFresh(maxIdleMs = 30_000)` and `TelnyxRTC.connectionIdleMs` let callers detect a socket that _appears_ connected but has been silent past the server's keep-alive cadence — typical when iOS thaws a frozen app and the kernel has already reaped the TLS session without notifying the JS WebSocket wrapper.
- **Auto-reconnect on socket error/close after login.** `telnyx.socket.error` and `telnyx.socket.close` now trigger the existing network-loss recovery path (`onNetworkUnavailable()` + `attemptReconnection()`). Previously these events were only logged, so a silent kernel-level abort during freeze left the client believing it was still connected indefinitely.

## [0.4.2](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/voice-sdk-v0.4.2) (2026-04-19)

### Bug Fixing

- **Fixed `Call.dtmf()` throwing `Invalid DTMF response received` on every call.** `isDTMFResponse` required `result.message === 'SENT'`, but the Telnyx gateway acks DTMF INFO requests with just `{ sessid }` — no `message` field — so valid acks were rejected even though the tones were delivered. The validator now accepts any JSON-RPC `result` frame that echoes back the session id (matching the Android SDK's fire-and-forget semantics). `DTMFResponse.result.message` remains in the type as an optional field so older gateway builds that still emit `{ message: 'SENT', sessid }` continue to type-check.
- Corrected the JSDoc on `Call.dtmf()` — it previously claimed the resolved value was the string `'SENT'`; the resolved value is the gateway ack object `{ sessid, message? }`.

## [0.4.1](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/voice-sdk-v0.4.1) (2026-04-01)

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
