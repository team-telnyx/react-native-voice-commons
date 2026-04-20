# Sending DTMF Tones

DTMF (Dual-Tone Multi-Frequency) tones are how your app interacts with phone-side menus — IVRs, conference PINs, voicemail shortcuts. The Telnyx React Voice Commons SDK exposes DTMF directly on the `Call` object.

## API

```ts
call.dtmf(digits: string): Promise<void>
```

Each character of `digits` is sent as a Verto `INFO` message to the Telnyx platform, which forwards it as RFC 2833 / `INFO` DTMF to the remote party.

### Accepted characters

| Group             | Characters          |
| ----------------- | ------------------- |
| Digits            | `0` `1` `2` … `9`   |
| Letters (A–D row) | `A` `B` `C` `D`     |
| Symbols           | `*` `#`             |

Any character outside this set is **silently dropped** by the underlying SDK. This is consistent with the [Telnyx Android WebRTC SDK](https://github.com/team-telnyx/telnyx-webrtc-android) behavior.

### State requirements

`dtmf()` will throw `Error('Cannot send DTMF in state: <state>')` unless the call is in the `ACTIVE` state. Check `call.currentState` or subscribe to `call.callState$` before sending if you cannot guarantee the call is active.

## Usage

### Single digit (dialpad press)

Wire each dialpad button to `dtmf` with a one-character string:

```tsx
function Dialpad({ call }: { call: Call }) {
  const onPress = (digit: string) => {
    call.dtmf(digit).catch((err) => {
      console.error(`DTMF "${digit}" failed:`, err);
    });
  };

  return (
    <View>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((d) => (
        <Button key={d} title={d} onPress={() => onPress(d)} />
      ))}
    </View>
  );
}
```

### Whole string (pre-recorded sequence)

For a known sequence such as a conference PIN or voicemail password, pass the whole string:

```tsx
// Punch in a conference PIN after the system prompt
await call.dtmf('482193#');
```

There is no built-in inter-digit delay — the SDK queues the `INFO` messages and the remote side (the Telnyx platform and the destination PBX) interprets them in order.

### Gating on state

If your UI lets the user press the dialpad before the call becomes `ACTIVE` (for example, during `CONNECTING`), guard the call site:

```tsx
import { TelnyxCallState } from '@telnyx/react-voice-commons-sdk';

const [state, setState] = useState(call.currentState);
useEffect(() => {
  const sub = call.callState$.subscribe(setState);
  return () => sub.unsubscribe();
}, [call]);

const onPress = (digit: string) => {
  if (state !== TelnyxCallState.ACTIVE) return;
  call.dtmf(digit);
};
```

## Platform notes

DTMF is handled entirely by the underlying `@telnyx/react-native-voice-sdk` and travels over the existing Verto signaling socket. There is **no native bridge work required** on iOS or Android — extending `TelnyxMainActivity` / `PKPushRegistryDelegate` as you already do for push notifications is sufficient.

## Common pitfalls

- **Calling `dtmf()` before the call is `ACTIVE`.** Will throw. Gate on `callState$` or on `CallStateHelpers.isActive(state)`.
- **Passing non-DTMF characters** (letters outside `A-D`, whitespace, punctuation other than `*#`). They are silently dropped — the platform will not error, but the tones you expect will not be sent. Normalize input upstream if you accept user-typed strings.
- **Expecting DTMF to interrupt the remote audio locally.** DTMF is a signaling feature; the local party does not hear a feedback tone unless your UI plays one. Most dialpads play a short local beep on press purely for UX.
