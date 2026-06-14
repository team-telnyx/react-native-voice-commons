# iOS Missed Call Notifications

On iOS, missed call detection works closely with CallKit and the app lifecycle. This guide explains iOS-specific behavior for detecting and displaying missed calls with the Telnyx React Voice Commons SDK.

For the general (cross-platform) missed-call detection pattern, see [Missed Call Notification Handling](./missed-call-notifications.md).

## How iOS Affects Missed Call Detection

iOS introduces three app states that change how call state events arrive:

| App State | What Happens | Missed-Call Implication |
|---|---|---|
| **Foreground** | `callState$` emits in real time | Straightforward — subscribe and track |
| **Background** | CallKit shows the native incoming-call UI; the SDK continues processing | State transitions may batch when the app returns to foreground |
| **Terminated (cold launch)** | The OS launches the app via VoIP push; the SDK reconnects and replays the call | You may receive the terminal state immediately on subscription |

### CallKit and Missed Calls

On iOS the SDK integrates with CallKit through `CallKitHandler` (automatically included in `TelnyxVoiceApp`). When an incoming VoIP push arrives:

1. CallKit displays the native incoming-call UI.
2. If the user taps **Decline** or the caller hangs up, the call transitions to a terminal state.
3. Your app receives the terminal state through `call.callState$`.

CallKit does **not** post a separate "missed call" notification — that is your app's responsibility. The SDK tells you the call ended; you decide whether it was missed.

## Detecting Missed Calls on iOS

### Use `CallStateHelpers.isTerminated` for All Terminal States

A missed call on iOS can terminate in any of three states, not just `ENDED`:

| Terminal State | iOS Scenario |
|---|---|
| `ENDED` | Caller hung up before the callee answered |
| `FAILED` | Call was rejected or SIP signaling failed during setup |
| `DROPPED` | Network dropped the call before it was established |

Use `CallStateHelpers.isTerminated(state)` instead of checking only `ENDED`:

```tsx
import {
  TelnyxCallState,
  CallStateHelpers,
} from '@telnyx/react-voice-commons-sdk';

function useMissedCallDetector(call: Call) {
  const [missed, setMissed] = React.useState(false);

  React.useEffect(() => {
    let wasActive = call.currentState === TelnyxCallState.ACTIVE;

    const sub = call.callState$.subscribe((state) => {
      if (state === TelnyxCallState.ACTIVE) {
        wasActive = true;
      }

      if (CallStateHelpers.isTerminated(state) && !wasActive) {
        setMissed(true);
      }
    });

    return () => sub.unsubscribe();
  }, [call]);

  return missed;
}
```

**Key differences from a simple `ENDED` check:**

- `FAILED` occurs when the callee rejects the call from the CallKit UI or when SIP returns a 4xx/5xx response during setup. Without checking this state, a rejected call would not be flagged as missed.
- `DROPPED` occurs when the network drops the call in the pre-answer phase (common on poor cellular connections). Without checking this state, a network-dropped call would silently disappear from your missed-call list.

### Check `currentState` on Subscribe

On iOS, a VoIP push may launch your app from a terminated state. By the time your component mounts and subscribes to `callState$`, the call may already be in a terminal state. Always check `call.currentState` at subscription time:

```tsx
React.useEffect(() => {
  let wasActive = CallStateHelpers.isActive(call.currentState);

  const sub = call.callState$.subscribe((state) => {
    if (CallStateHelpers.isActive(state)) {
      wasActive = true;
    }

    if (CallStateHelpers.isTerminated(state) && !wasActive) {
      // Call was missed
    }
  });

  return () => sub.unsubscribe();
}, [call]);
```

Using `CallStateHelpers.isActive` covers both `ACTIVE` and `HELD`, so a call that was briefly active then held and then ended is not incorrectly classified as missed.

## Storing Missed Call Records

The SDK `Call` object does **not** expose a `startedAt` or timestamp property. When recording a missed call for display, store your own timestamp at detection time:

```tsx
interface MissedCallRecord {
  callId: string;
  callerName: string;
  callerNumber: string;
  detectedAt: Date; // app-owned timestamp
}

function useMissedCallRecorder(
  call: Call,
  onMissed: (record: MissedCallRecord) => void
) {
  React.useEffect(() => {
    let wasActive = CallStateHelpers.isActive(call.currentState);

    const sub = call.callState$.subscribe((state) => {
      if (CallStateHelpers.isActive(state)) {
        wasActive = true;
      }

      if (CallStateHelpers.isTerminated(state) && !wasActive) {
        onMissed({
          callId: call.callId,
          callerName: call.callerName,
          callerNumber: call.callerNumber,
          detectedAt: new Date(),
        });
      }
    });

    return () => sub.unsubscribe();
  }, [call, onMissed]);
}
```

Do **not** reference `call.startedAt` — that property does not exist on the SDK `Call` class.

## iOS Background State Considerations

### App Is in the Background

When your app is in the background and an incoming call arrives:

1. CallKit shows the native incoming-call UI.
2. The SDK processes the call in the background.
3. If the user does not answer, the call transitions to a terminal state.
4. Your `callState$` subscription receives the terminal state, but the React component may not re-render until the app returns to the foreground.

**Recommendation:** Persist missed-call records to storage (e.g., `AsyncStorage`) rather than only holding them in React state. This ensures missed calls are available when the app returns to the foreground:

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';

async function persistMissedCall(record: MissedCallRecord) {
  const existing = await AsyncStorage.getItem('missedCalls');
  const calls: MissedCallRecord[] = existing ? JSON.parse(existing) : [];
  calls.push(record);
  await AsyncStorage.setItem('missedCalls', JSON.stringify(calls));
}
```

### App Is Terminated (Cold Launch from VoIP Push)

When the OS launches the app from a terminated state to deliver a VoIP push:

1. The SDK handles reconnection and login automatically (see [Push Notification App Setup](../push-notification/app-setup.md)).
2. The call may already be in a terminal state by the time your component mounts.
3. Use `TelnyxVoipClient.isLaunchedFromPushNotification()` to detect this scenario and avoid double-login.

See the [double-login guard](../push-notification/app-setup.md#step-3-detect-push-launched-cold-starts-avoid-double-login) section in the push notification docs for the full pattern.

### Double-Login and False Missed Calls

A double-login (calling `login*` on mount when the SDK is already handling the push) causes the socket to disconnect and the call to terminate prematurely. The call would then appear as "missed" even though it was actually an integration bug. Always guard auto-login:

```tsx
React.useEffect(() => {
  TelnyxVoipClient.isLaunchedFromPushNotification().then((isFromPush) => {
    if (!isFromPush) {
      voipClient.loginFromStoredConfig();
    }
  });
}, []);
```

See [Push Notification App Setup](../push-notification/app-setup.md) for the complete double-login prevention guide.

## Displaying a Missed Call Badge on iOS

After detecting a missed call, display it in your call history or as a badge:

```tsx
function CallHistoryItem({
  record,
}: {
  record: MissedCallRecord;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon
          name="call-missed"
          color="#FF3B30"
          size={24}
        />
      </View>
      <View style={styles.info}>
        <Text style={styles.caller}>
          {record.callerName || record.callerNumber || 'Unknown'}
        </Text>
        <Text style={styles.missedText}>Missed</Text>
      </View>
      <Text style={styles.timestamp}>
        {formatTimestamp(record.detectedAt)}
      </Text>
    </View>
  );
}
```

Note that we use `record.detectedAt` (our own `Date` object) for the timestamp display, not any SDK property.

## Common Pitfalls on iOS

- **Only checking `ENDED`.** On iOS, a call rejected from the CallKit UI or dropped by the network emits `FAILED` or `DROPPED`, not `ENDED`. Always use `CallStateHelpers.isTerminated(state)` to cover all three terminal states.
- **Referencing `call.startedAt`.** The SDK `Call` class does not expose a public timestamp. Store your own `Date` when you detect the missed call.
- **Missing the call state on cold launch.** On VoIP push cold starts, the call may already be terminal when your component mounts. Check `call.currentState` before subscribing.
- **Relying on React state for background missed calls.** React state may not persist across app backgrounding. Use `AsyncStorage` or another persistent store.
- **Double-login causing false missed calls.** An unguarded `login*` call on mount can disconnect the push-launched session, making a legitimate incoming call appear as missed.

## See Also

- [Missed Call Notification Handling](./missed-call-notifications.md) — cross-platform missed-call detection guide
- [Push Notification App Setup](../push-notification/app-setup.md) — configuring push notifications and double-login prevention
- [Push Notification Portal Setup](../push-notification/portal-setup.md) — Telnyx portal configuration for VoIP certificates
- [Call States](../enumerations/TelnyxCallState.md) — full list of call states and `CallStateHelpers`
- [DTMF](./dtmf.md) — sending DTMF tones during an active call
