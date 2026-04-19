# CHANGELOG.md

## [0.4.0] (2026-04-19)

### Enhancement

- **DTMF support.** Added `Call.dtmf(digits: string): Promise<void>` — sends DTMF tones on the current call as Verto `INFO` messages. Accepts a single digit (e.g. `"5"`) or a whole string (e.g. `"1234#"`). Valid characters are `0-9`, `A-D`, `*`, and `#`; anything else is silently dropped by the underlying SDK. Call state must be `ACTIVE` — will throw otherwise.

### Bug Fixing

- **Fixed `IllegalArgumentException: Could not find @ReactModule annotation in VoicePnBridgeModule` crash** on Android when the app is cold-started by a push notification action (Answer/Decline). React Native 0.79+ requires `@ReactModule(name = …)` on native modules that are looked up by class via `ReactContext.getNativeModule(Class)`. The annotation has been added to `VoicePnBridgeModule`, and the module name is now sourced from a single `NAME` constant.

## [0.3.1] (2026-04-16)

### Bug Fixing

- Fixed stale `CONNECTED` state during background disconnect: `SessionManager.disconnect()` now emits `DISCONNECTED` before awaiting the underlying client teardown. Previously, observers (including the auto-reconnect logic in `TelnyxVoiceApp`) could read a stale `CONNECTED` value while the socket was being torn down, causing auto-reconnection to be skipped and subsequent `newCall()` attempts to fail with `Cannot make call when connection state is: DISCONNECTED` or `No connection exists. Please connect first.`
- Tracked calls are now cleared on disconnect. Previously, calls left in non-terminal states when the socket was torn down would accumulate across background/foreground cycles, since a dead socket never emits the `ENDED`/`FAILED` events that normally trigger per-call cleanup.

## [0.3.0] (2026-04-15)

### ⚠️ Breaking changes

- **`expo-router` is no longer a dependency of the SDK.** The SDK previously navigated the host app in a few places (`useAppStateHandler` on background disconnect, `CallKitHandler` after CallKit answer/end). Those calls have been removed — navigation is now exclusively the host app's responsibility.
  - **Migration for Expo consumers:** subscribe to `voipClient.connectionState$` and `voipClient.activeCall$` in your app and navigate there. Example:
    ```tsx
    useEffect(() => {
      const sub = voipClient.connectionState$.subscribe((state) => {
        if (state === TelnyxConnectionState.DISCONNECTED) {
          router.replace('/');
        }
      });
      return () => sub.unsubscribe();
    }, []);
    ```
  - `CallKitHandler` already exposed `onNavigateToDialer` / `onNavigateBack` callback props; those are now the only way to wire navigation.
  - The `navigateToLoginOnDisconnect` option on `useAppStateHandler` is retained in the type signature for source compatibility but no longer has any effect.
- **Bare React Native (non-Expo) projects are now supported.** Metro bundling no longer fails on missing `expo-router`; SDK-level behavior is identical for Expo and bare RN consumers.

### Enhancement

- **`react-native-url-polyfill` is now a direct dependency and auto-loaded** from the SDK entry point. Previously, apps running Hermes crashed on the second login attempt with `URLSearchParams.set is not implemented` because the SDK constructs the WebSocket URL via `URLSearchParams`, which is incomplete in Hermes. No action required from consumers.

## [0.2.0](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/commons-sdk-v0.2.0) (2026-04-01)

### Enhancement

- Upgraded low-level SDK dependency from `@telnyx/react-native-voice-sdk@0.4.0` to `@telnyx/react-native-voice-sdk@0.4.1`

### Bug Fixing

- Fixed push notification flags not being reset after call action execution, causing subsequent calls to be auto-answered

## [0.1.9](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/0.1.9) (2026-03-19)

### Enhancement

- Upgraded low-level SDK dependency from `@telnyx/react-native-voice-sdk@0.3.0` to `@telnyx/react-native-voice-sdk@0.4.0`
- Commons SDK version now propagates to the low-level SDK User-Agent via `sdkVersion` option
- Added hidden long-press button on status text to disable push notifications for debugging
- Disabled debug logging and call reports by default for production readiness

### Bug Fixing

- Fixed stale push notification state by clearing pending VoIP push data on call end
- Fixed User-Agent inconsistency — all WebSocket messages now use `ReactNative-{version}` format
- Fixed unnecessary JSON-RPC ACK messages (invite, answer, ringing) that were causing issues
- Fixed `telnyxCallControlId` ReferenceError on inbound calls in the low-level SDK

## [0.1.8](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/0.1.8) (2026-03-09)

### Bug Fixing

• Fixed duplicate CXProvider overwrite causing `CXEndCallAction` error 4 (unknownCallUUID) — guard `setupCallKit()` to prevent async `setupAutomatically()` from overwriting the provider created by `setupSynchronously()` during VoIP push handling
• Fixed intermittent audio loss on push notification calls — defer `CXAnswerCallAction.fulfill()` until `reportCallConnected()` when the WebRTC peer connection is ready
• Aligned iOS audio session handling with native Telnyx iOS SDK pattern (`RTCAudioSessionConfiguration.webRTC()` with `lockForConfiguration`/`unlockForConfiguration`)
• Fixed endCall not dismissing CallKit UI — check `endCall()` return value and fallback to `reportCallEnded()` when CXEndCallAction fails
• Fixed push notification answer crash when voipClient is not yet initialized — defer to `checkForInitialPushNotification()` instead of failing the call
• Added `voipClient.queueAnswerFromCallKit()` call when handling push notification answer for auto-answer on INVITE arrival
• Fixed call ENDED state not received by subscribers
• Added platform guards for iOS-only VoIP bridge methods on Android
• Fixed push data race condition in Expo apps

## [0.1.8-beta.1](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/0.1.8-beta.1) (2026-03-04)

### Bug Fixing

• Fixed duplicate CXProvider overwrite causing `CXEndCallAction` error 4 (unknownCallUUID) — guard `setupCallKit()` to prevent async `setupAutomatically()` from overwriting the provider created by `setupSynchronously()` during VoIP push handling
• Fixed intermittent audio loss on push notification calls — defer `CXAnswerCallAction.fulfill()` until `reportCallConnected()` when the WebRTC peer connection is ready
• Aligned iOS audio session handling with native Telnyx iOS SDK pattern (`RTCAudioSessionConfiguration.webRTC()` with `lockForConfiguration`/`unlockForConfiguration`)
• Fixed endCall not dismissing CallKit UI — check `endCall()` return value and fallback to `reportCallEnded()` when CXEndCallAction fails
• Fixed push notification answer crash when voipClient is not yet initialized — defer to `checkForInitialPushNotification()` instead of failing the call
• Added `voipClient.queueAnswerFromCallKit()` call when handling push notification answer for auto-answer on INVITE arrival

## [0.1.8-beta.0](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/0.1.8-beta.0) (2026-02-28)

### Bug Fixing

• Fixed push data race condition in Expo apps

## [0.1.7](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/0.1.7) (2026-02-20)

### Enhancement

• Added `TelnyxVoipClient.isLaunchedFromPushNotification()` static method to check if the app was cold-started from a push notification, allowing consumers to skip auto-login and avoid double-login races
• `createTelnyxVoipClient()` now returns a singleton — safe to call inside React component bodies without creating a new instance on every render
• Added `destroyTelnyxVoipClient()` to tear down the singleton when a fresh instance is needed
• `TelnyxVoiceApp` now automatically wires the `voipClient` on the CallKit coordinator on mount — consumers no longer need to manually call `setVoipClient()` at the correct component level

### Bug Fixing

• Fixed cold-start push notification failures caused by double-login race between user auto-login and SDK internal push login
• Fixed CallKit coordinator having no `voipClient` reference when user answered a call via CallKit before navigating to the correct screen
• Fixed `call_id` extraction in `checkForInitialPushNotification` — the double-nested path `pushData.metadata?.metadata?.call_id` never resolved, so the CallKit coordinator was bypassed on iOS
• Refactored `checkForInitialPushNotification` into `getAndroidPushData` and `getIOSPushData` helpers to reduce nesting and improve readability

### Deprecation

• `setVoipClient()` on `CallKitCoordinator` and `useCallKitCoordinator()` hook is now deprecated — `TelnyxVoiceApp` handles this automatically

## [0.1.7-beta.0](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/0.1.7-beta.0) (2026-02-18)

### Bug Fixing

• Fixed `call_id` extraction in `checkForInitialPushNotification` — the double-nested path `pushData.metadata?.metadata?.call_id` never resolved, so the CallKit coordinator was bypassed and all iOS push calls fell through to direct handling
• Refactored `checkForInitialPushNotification` into `getAndroidPushData` and `getIOSPushData` helpers to reduce nesting and improve readability

## [0.1.6](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/0.1.6) (2025-12-09)

### Enhancement

• Added Android native components to npm package for proper distribution
• Complete Android native integration support for Firebase messaging and call management

### Bug Fixing

• Fixed missing Android directory in npm package files array
• Resolved native component availability issues for Android integrations

## [0.1.5](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/0.1.5) (2025-12-08)

### Enhancement

• Updated to use @telnyx/react-native-voice-sdk@0.3.0 with advanced media events support

## [0.1.4](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/0.1.4) (2025-11-25)

### Enhancement

• Enhanced 4G/WiFi reconnection mechanism for better network handling
• iOS version integration improvements

## [0.1.3](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/0.1.3) (2025-11-20)

### Enhancement

• Fixed background answer functionality for iOS
• Added connecting state to Telnyx client
• Improved reconnection logic for Android using foreground service implementation

## [0.1.2](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/0.1.2) (2025-11-04)

### Enhancement

• Comprehensive package README with integration examples
• Documentation for credential-based and token-based authentication
• Native integration guides for Android (MainActivity) and iOS (AppDelegate)
• Examples for push notification setup
• Troubleshooting section

### Bug Fixing

• Package metadata and npm publishing configuration

## [0.1.1](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/0.1.1) (2025-11-02)

### Enhancement

• Initial npm package release
• Core VoIP client (`TelnyxVoipClient`)
• TelnyxVoiceApp component for React Native lifecycle management
• CallKit integration for iOS native call UI
• Android ConnectionService support
• Push notification handling (FCM for Android, APNs for iOS)
• Reactive state streams with RxJS
• Call management APIs (make, answer, hold, mute, transfer, hangup)
• Connection state management
• Call state machine
• Automatic reconnection logic
• Session management
• TypeScript type definitions

## [0.1.0](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/0.1.0) (2025-11-01)

### Enhancement

• Initial development version
• Basic VoIP functionality
• Call management
• State management interfaces
