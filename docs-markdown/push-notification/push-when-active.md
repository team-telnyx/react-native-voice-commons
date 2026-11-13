# Push Notifications While Connected

## Overview

By default, a live client for the same credential identity can receive an incoming call over its WebSocket without mobile push being triggered. Set `pushWhenActive: true` on the connected clients that should participate in the push-when-active flow, including the JavaScript browser client. Enabling the option only in React Native does not change a browser registration that logged in with `pushWhenActive: false`.

This is useful for call waiting and multi-device calling. It is disabled by default.

## Enable `pushWhenActive`

Complete the normal PushKit (iOS) or FCM (Android) setup first, then set `pushWhenActive: true` when logging in. Continue to provide the device push token through `pushNotificationDeviceToken`.

### Credential authentication

```tsx
const config = createCredentialConfig('your_sip_username', 'your_sip_password', {
  pushNotificationDeviceToken: voipPushToken,
  pushWhenActive: true,
});

await voipClient.login(config);
```

### Token authentication

```tsx
const config = createTokenConfig('your_jwt_token', {
  pushNotificationDeviceToken: voipPushToken,
  pushWhenActive: true,
});

await voipClient.loginWithToken(config);
```

The push token is configured at login time; do not pass it again to `call.answer()`.

## When a web client is also connected

Enable `pushWhenActive: true` on the **JavaScript web client as well as this mobile client** when they use the same credential identity. The JavaScript default is `false`: a browser logged in with that default can receive the call over its active WebSocket without triggering mobile push. Enabling the option only in the mobile app does not change the browser's login configuration.

```javascript
import { TelnyxRTC } from '@telnyx/webrtc';

const webClient = new TelnyxRTC({
  login: 'your_sip_username',
  password: 'your_sip_password',
  pushWhenActive: true,
});

webClient.connect();
```

For token authentication, use `login_token` with the same `pushWhenActive: true` option. Each mobile app registers its own push token; do not copy a mobile token into the browser configuration. Disconnect the existing browser before replacing it, then reconnect so a fresh login sends both `userVariables.push_when_active: true` and `userVariables.pn_late_fanout: true`. Apply the option to every browser client that can remain connected for this identity.

These login flags are distinct from the connection-level `simultaneous_ringing` setting. Push wake-up and delivery of the call invitation over WebSocket are separate steps; registering several tokens does not by itself enable push alongside an active browser.

See [cross-client setup and verification](https://developers.telnyx.com/docs/voice/webrtc/push-notifications#ring-mobile-devices-while-a-browser-is-connected) for the shared flow and troubleshooting. If mobile push works with web disconnected but stops when web connects, inspect the **web login flags first**. Retest with a fresh inbound call after reconnecting; if it still fails with both flags enabled, collect the call ID, UTC timestamp, and SDK versions without including credentials or complete push tokens.

## When another device answers

If the same incoming call is delivered to several devices and another device answers first, the ringing call on this device ends normally. Dismiss any incoming-call UI and do not show an error or retry prompt.

The React Voice Commons SDK handles native CallKit and ConnectionService cleanup. For direct iOS SDK integrations, see the [iOS Push Notification App Setup](https://github.com/team-telnyx/telnyx-webrtc-ios/blob/main/docs-markdown/push-notification/app-setup.md#handling-calls-answered-on-another-device).

## See Also

- [Push Notification App Setup](./app-setup.md)
- [Portal Setup](./portal-setup.md)
