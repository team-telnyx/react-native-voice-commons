# Push Notifications While Connected

## Overview

By default, a device with an active WebSocket connection is not kept eligible for another incoming VoIP push. Enable `pushWhenActive` when a user may have an active or held call and must still receive a subsequent incoming call on the same device.

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

## When another device answers

If the same incoming call is delivered to several devices and another device answers first, the ringing call on this device ends normally. Dismiss any incoming-call UI and do not show an error or retry prompt.

The React Voice Commons SDK handles native CallKit and ConnectionService cleanup. For direct iOS SDK integrations, see the [iOS Push Notification App Setup](https://github.com/team-telnyx/telnyx-webrtc-ios/blob/main/docs-markdown/push-notification/app-setup.md#handling-calls-answered-on-another-device).

## See Also

- [Push Notification App Setup](./app-setup.md)
- [Portal Setup](./portal-setup.md)
