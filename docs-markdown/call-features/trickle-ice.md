# Trickle ICE

Trickle ICE is an optimization for WebRTC connection setup. Instead of waiting for the full set of ICE candidates before sending the offer or answer, Trickle ICE sends the initial SDP immediately and delivers candidates one at a time as they are discovered. This can reduce call setup latency, especially on networks where gathering all candidates takes time.

The Telnyx React Voice Commons SDK supports Trickle ICE via the `useTrickleIce` option. It is **disabled by default**.

## How it works

Without Trickle ICE, the caller waits until every ICE candidate is gathered before sending the SDP offer. With Trickle ICE enabled:

1. The SDK sends the SDP offer/answer immediately with the candidates it has so far.
2. Additional candidates are sent individually as they are discovered.
3. The remote side processes each candidate as it arrives rather than waiting for the full set.

The SDK adds `a=ice-options:trickle` to the session-level section of the SDP to signal Trickle ICE support, consistent with the native Telnyx Android and iOS SDKs.

## Enabling Trickle ICE

You can enable Trickle ICE at two levels: on the **client** (applies to all calls) or on the **login config** (applies to a specific session).

### Client-level (recommended)

Pass `useTrickleIce` when creating the `TelnyxVoipClient`:

```tsx
import { createTelnyxVoipClient } from '@telnyx/react-voice-commons-sdk';

const voipClient = createTelnyxVoipClient({
  useTrickleIce: true,
});
```

This sets the default for every call made through this client. Individual login calls can still override it.

### Per-login config

Pass `useTrickleIce` in the credential or token config when logging in. This overrides the client-level setting for that session:

```tsx
import { createCredentialConfig } from '@telnyx/react-voice-commons-sdk';

// Credential auth
const config = createCredentialConfig('sip_user', 'sip_password', {
  useTrickleIce: true,
  pushNotificationDeviceToken: 'your_device_token',
});

await voipClient.login(config);
```

```tsx
import { createTokenConfig } from '@telnyx/react-voice-commons-sdk';

// Token auth
const config = createTokenConfig('your_jwt_token', {
  useTrickleIce: true,
  pushNotificationDeviceToken: 'your_device_token',
});

await voipClient.loginWithToken(config);
```

### Precedence

When both the client-level and login-config options are set, the **login config takes precedence**. If the login config omits `useTrickleIce`, the client-level default is used.

| Client `useTrickleIce` | Login config `useTrickleIce` | Effective value |
| ---------------------- | ---------------------------- | --------------- |
| `false` (default)      | omitted                      | `false`         |
| `false` (default)      | `true`                       | `true`          |
| `true`                 | omitted                      | `true`          |
| `true`                 | `false`                      | `false`         |

## Disabling Trickle ICE

Trickle ICE is off by default. If you previously enabled it and want to disable it:

- **Client-level**: Set `useTrickleIce: false` (or simply omit it) when calling `createTelnyxVoipClient`.
- **Per-login**: Omit `useTrickleIce` from the credential/token config, or set it to `false`.

```tsx
const voipClient = createTelnyxVoipClient({
  useTrickleIce: false, // explicit, or just omit — default is false
});
```

## Persistence

When you log in with `useTrickleIce: true`, the SDK persists the setting to AsyncStorage under the key `@use_trickle_ice`. On subsequent reconnections — including auto-reconnect via `TelnyxVoiceApp` and push-notification-triggered reconnects — the stored value is used as the default, unless a new login config explicitly overrides it.

## When to use Trickle ICE

Trickle ICE is most beneficial when:

- **Call setup latency matters.** If your users are on networks with slow STUN/TURN gathering (e.g., symmetric NATs that require relay candidates), Trickle ICE can shave seconds off call setup time.
- **The signaling channel is reliable.** Trickle ICE relies on delivering each candidate as a separate message. If your WebSocket connection drops candidates, the call may fall back to the candidates that arrived before the disruption.

Trickle ICE is not necessary when:

- **The network is fast and direct.** On low-latency networks where host candidates succeed immediately, the full ICE gathering completes quickly and the optimization has negligible benefit.
- **You prefer simpler debugging.** With Trickle ICE disabled, the entire SDP exchange happens in a single round trip, making it easier to inspect in logs.

## Platform notes

Trickle ICE is handled by the underlying `@telnyx/react-native-voice-sdk`. No additional native configuration is required on iOS or Android beyond the standard `TelnyxMainActivity` / `PKPushRegistryDelegate` setup you already have for push notifications.

## Common pitfalls

- **Mixing Trickle ICE and non-Trickle ICE endpoints.** If one side supports Trickle ICE and the other does not, the connection still works — the Trickle-ICE-enabled side will fall back to the traditional full SDP exchange. No special handling is needed.
- **Expecting instant call setup.** Trickle ICE reduces, but does not eliminate, ICE gathering time. The first candidates are sent immediately, but the call still requires at least one viable candidate pair to complete.
- **Changing `useTrickleIce` mid-call.** The setting is evaluated at call creation time. Changing the client option or login config after a call has started does not affect the ongoing call.
