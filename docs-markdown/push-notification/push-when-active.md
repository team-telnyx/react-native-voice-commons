# Push-When-Active & Answered-Elsewhere Handling

## Overview

When `pushWhenActive` is enabled, an incoming call may be delivered to more than one device or client simultaneously. For example, a web client may receive the call over an active WebSocket while mobile devices receive push notifications. When one device answers, Telnyx ends the remaining call attempts on the other devices.

This guide explains how to:

- Enable `pushWhenActive` in your configuration
- Understand what happens when another device answers
- Detect the "answered-elsewhere" outcome and dismiss your incoming-call UI
- Map SDK call states to the correct user-facing behavior

## Prerequisites

This guide assumes you have completed the [Push Notification App Setup](./app-setup.md) and have push notifications working on at least one device.

## Enabling pushWhenActive

Set `pushWhenActive: true` in the options passed to `createCredentialConfig` or `createTokenConfig`. Complete the normal PushKit (iOS) or FCM (Android) setup first and configure its device token with `pushNotificationDeviceToken`. The SDK reuses that configured token — you do not need to pass it again at answer time.

### Credential-Based Authentication

```tsx
import { createCredentialConfig } from '@telnyx/react-voice-commons-sdk';

const config = createCredentialConfig('your_sip_username', 'your_sip_password', {
  debug: true,
  pushNotificationDeviceToken: voipPushToken,
  pushWhenActive: true, // Include answered_device_token in answer messages
});

await voipClient.login(config);
```

### Token-Based Authentication

```tsx
import { createTokenConfig } from '@telnyx/react-voice-commons-sdk';

const config = createTokenConfig('your_jwt_token', {
  debug: true,
  pushNotificationDeviceToken: voipPushToken,
  pushWhenActive: true, // Include answered_device_token in answer messages
});

await voipClient.loginWithToken(config);
```

### How It Works

1. When `pushWhenActive` is `true` and a `pushNotificationDeviceToken` is set, the SDK includes the device's push token as `answered_device_token` in the `telnyx_rtc.answer` signaling payload.
2. The Telnyx backend receives the answer with the `answered_device_token` and uses it to identify which device answered. It then ends the remaining call attempts on the other devices.
3. If `pushWhenActive` is `false` (default) or no push token is configured, the `answered_device_token` field is omitted from the answer message.

> **Note:** `pushWhenActive` does not create a push token. Supply the token through the normal push setup when logging in; customers do not pass it again to `call.answer()`. The SDK uses the configured token internally.

## Handling Calls Answered on Another Device

When `pushWhenActive` is enabled and multiple devices receive the same incoming call, only one device answers. Telnyx then notifies the remaining devices that the call was answered elsewhere by ending their call leg.

Your app should treat this as a normal call-end outcome, **not** as a call failure. The remaining devices do not need to do anything special — the call simply transitions to a terminated state.

### What Your App Should Do

When the call ends because another device answered:

- **Dismiss the incoming call UI** — remove the ringing/answer screen
- **Stop ringtone and vibration** — the SDK handles this via CallKit (iOS) and ConnectionService (Android) automatically
- **End the CallKit / ConnectionService call if one is active** — the SDK handles this internally
- **Mark the call as ended or answered elsewhere** — update your app state
- **Do not show an error to the user** — this is expected behavior, not a failure

> The React Voice Commons SDK performs the native CallKit/ConnectionService cleanup internally. Apps integrating the lower-level iOS SDK directly must also end a reported CallKit call with `.answeredElsewhere`; see the [iOS Push Notification App Setup](https://github.com/team-telnyx/telnyx-webrtc-ios/blob/main/docs-markdown/push-notification/app-setup.md#callkit-behavior).

## Event & State Mapping

The React Voice Commons SDK exposes call state through the `TelnyxCallState` enum and the `callState$` observable on each `Call` object. When a call is answered on another device, the remaining devices observe the call transition to a terminated state.

### TelnyxCallState Values

| State | Description |
|-------|-------------|
| `RINGING` | Call is being received (incoming) or initiated (outgoing) |
| `CONNECTING` | Call is connecting after being answered |
| `ACTIVE` | Call has been answered and media is flowing |
| `HELD` | Call is on hold |
| `ENDED` | Call has ended normally — **this is the typical state for answered-elsewhere** |
| `FAILED` | Call failed to connect or was rejected |
| `DROPPED` | Call lost network connectivity (may reattach) |

### Detecting Answered-Elsewhere

When another device answers, the call on the remaining devices transitions to `TelnyxCallState.ENDED`. Use `CallStateHelpers.isTerminated()` to detect any terminated state (`ENDED`, `FAILED`, or `DROPPED`) and dismiss your incoming-call UI:

```tsx
import React from 'react';
import { View, Text } from 'react-native';
import {
  TelnyxVoipClient,
  TelnyxCallState,
  CallStateHelpers,
} from '@telnyx/react-voice-commons-sdk';

export function IncomingCallScreen({ voipClient }: { voipClient: TelnyxVoipClient }) {
  const [callState, setCallState] = React.useState<TelnyxCallState | null>(null);

  React.useEffect(() => {
    let callStateSub: { unsubscribe: () => void } | undefined;

    // Subscribe to the active call's state changes
    const callSub = voipClient.activeCall$.subscribe((call) => {
      // The active call can change (for example, during call waiting), so do
      // not retain the prior call's state subscription.
      callStateSub?.unsubscribe();
      callStateSub = undefined;

      if (call) {
        setCallState(call.currentState);
        callStateSub = call.callState$.subscribe((state) => {
          setCallState(state);
          // When the call ends (answered elsewhere, hung up, or failed),
          // dismiss the incoming-call UI
          if (CallStateHelpers.isTerminated(state)) {
            console.log('Call ended — dismissing incoming call UI');
            // Navigate away from the incoming call screen
            // e.g., navigation.goBack() or navigation.replace('Home')
          }
        });
      } else {
        setCallState(null);
      }
    });

    return () => {
      callStateSub?.unsubscribe();
      callSub.unsubscribe();
    };
  }, [voipClient]);

  if (callState === null) {
    return null; // No active call
  }

  if (CallStateHelpers.isTerminated(callState)) {
    return null; // Call ended — UI already dismissed
  }

  return (
    <View>
      <Text>Incoming call — state: {callState}</Text>
      {/* Your incoming call UI with answer/decline buttons */}
    </View>
  );
}
```

### Using the Synchronous Accessor

For cases where the call may already be in a terminal state by the time your component mounts (e.g., the push flow already processed the call end), check `call.currentState` before subscribing:

```tsx
import React from 'react';

React.useEffect(() => {
  const call = voipClient.currentActiveCall;
  if (call && CallStateHelpers.isTerminated(call.currentState)) {
    // Call already ended — do not show incoming call UI
    return;
  }
  // ... subscribe to callState$ as shown above
}, [voipClient]);
```

## Expected Flow

1. App connects with `pushWhenActive: true` and a valid push token.
2. SDK registers the device push token with the Telnyx backend.
3. An incoming call is delivered to multiple devices via push notifications.
4. One device answers using the normal `call.answer()` API.
5. The answering device's SDK includes `answered_device_token` in the answer payload.
6. Telnyx ends the remaining call attempts on the other devices.
7. The remaining devices observe `callState$` emit `TelnyxCallState.ENDED`.
8. Your app detects the terminated state and dismisses the incoming-call UI.

## Common Pitfalls

### Treating Answered-Elsewhere as an Error

When the call ends because another device answered, the state is `ENDED` (not `FAILED`). Do not show an error dialog or retry logic — this is a normal outcome of multidevice push.

### Forgetting to Dismiss the UI

If your incoming-call screen only dismisses on explicit user action (answer/decline), it will stay visible after the call ends on another device. Always subscribe to `callState$` and dismiss the UI when `CallStateHelpers.isTerminated(state)` returns `true`.

### Passing the Push Token at Answer Time

You do not need to pass the push token when calling `call.answer()`. The SDK uses the configured `pushNotificationDeviceToken` internally. Passing it again has no effect.

## See Also

- [Push Notification App Setup](./app-setup.md) — Complete push notification setup including FCM/APNs configuration and avoiding double-login.
- [Portal Setup](./portal-setup.md) — Telnyx portal configuration for push certificates and FCM keys.
