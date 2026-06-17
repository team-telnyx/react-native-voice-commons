# Missed Call Notification Handling

When an incoming call is not answered, your app needs to detect the missed state and present it to the user. The Telnyx React Voice Commons SDK exposes call lifecycle events that make it straightforward to track missed calls and display appropriate UI.

For iOS-specific missed call handling with CallKit integration, see the iOS Missed Call Notifications guide (available in this directory once merged).

## Overview

A "missed call" in the Telnyx SDK context is any incoming call that transitions to a terminated state without ever reaching `ACTIVE`. This can happen when:

- The caller hangs up before the callee answers
- The call rings until it times out (no answer)
- The network drops the call before it is established

The SDK does not have a dedicated "missed" call state. Instead, you detect the pattern by observing the call state transitions: a call that goes through `RINGING` or `CONNECTING` and then ends without becoming `ACTIVE` is a missed call.

## Detecting Missed Calls

### Using callState$ Observables

Subscribe to `call.callState$` on each incoming call to track its lifecycle:

```tsx
import React from 'react';
import {
  Call,
  CallStateHelpers,
} from '@telnyx/react-voice-commons-sdk';

function useMissedCallDetector(call: Call) {
  const [missed, setMissed] = React.useState(false);

  React.useEffect(() => {
    setMissed(false); // Reset for each new call
    let wasActive = CallStateHelpers.isActive(call.currentState);

    const sub = call.callState$.subscribe((state) => {
      if (CallStateHelpers.isActive(state)) {
        wasActive = true;
      }

      if (
        CallStateHelpers.isTerminated(state) &&
        !wasActive
      ) {
        setMissed(true);
      }
    });

    return () => sub.unsubscribe();
  }, [call]);

  return missed;
}
```

**How it works:**

1. When the `call` prop changes, `missed` is reset to `false` so state from a previous call doesn't leak
2. `wasActive` is initialized based on the call's current state — `true` if already `ACTIVE` or `HELD`
3. If the call transitions to an active state, we set `wasActive = true`
4. When the call reaches a terminal state (`ENDED`, `FAILED`, or `DROPPED`) and `wasActive` is still `false`, the call was never answered — it was missed

### Using the Active Call Stream

For app-wide missed call detection, monitor `voipClient.activeCall$`:

```tsx
import React from 'react';
import {
  Call,
  TelnyxVoipClient,
  CallStateHelpers,
} from '@telnyx/react-voice-commons-sdk';
import { filter } from 'rxjs/operators';

function MissedCallMonitor({
  voipClient,
  onMissedCall,
}: {
  voipClient: TelnyxVoipClient;
  onMissedCall: (call: Call) => void;
}) {
  const previousCallRef = React.useRef<Call | null>(null);
  const wasActiveRef = React.useRef(false);

  React.useEffect(() => {
    const innerSubs: any[] = [];

    const sub = voipClient.activeCall$.subscribe((call) => {
      if (call && call !== previousCallRef.current) {
        // New call appeared
        previousCallRef.current = call;
        wasActiveRef.current = CallStateHelpers.isActive(call.currentState);

        // Subscribe to the new call's state
        const stateSub = call.callState$.subscribe((state) => {
          if (CallStateHelpers.isActive(state)) {
            wasActiveRef.current = true;
          }
          if (CallStateHelpers.isTerminated(state) && !wasActiveRef.current) {
            onMissedCall(call);
          }
        });

        const termSub = call.callState$
          .pipe(filter((s) => CallStateHelpers.isTerminated(s)))
          .subscribe(() => stateSub.unsubscribe());

        innerSubs.push(stateSub, termSub);
      }
    });

    return () => {
      sub.unsubscribe();
      innerSubs.forEach((s) => s.unsubscribe());
    };
  }, [voipClient, onMissedCall]);

  return null;
}
```

## Displaying Missed Call Information

Once you have detected a missed call, you can display it in your UI:

```tsx
import { View, Text } from 'react-native';
import { Call } from '@telnyx/react-voice-commons-sdk';
// Icon and formatTimestamp are app-specific placeholders
// Replace with your own icon library and date formatting utility

interface CallRecord {
  call: Call;
  timestamp: number; // app-recorded time when the call was detected
  wasMissed: boolean; // true if the call was never answered
}

function CallHistoryItem({ record }: { record: CallRecord }) {
  const wasMissed = record.wasMissed;

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon
          name={wasMissed ? 'call-missed' : 'call-received'}
          color={wasMissed ? '#FF3B30' : '#34C759'}
          size={24}
        />
      </View>
      <View style={styles.info}>
        <Text style={styles.caller}>
          {record.call.callerName || record.call.callerNumber || 'Unknown'}
        </Text>
        <Text style={[styles.status, wasMissed && styles.missedText]}>
          {wasMissed ? 'Missed' : 'Answered'}
        </Text>
      </View>
      <Text style={styles.timestamp}>
        {formatTimestamp(record.timestamp)}
      </Text>
    </View>
  );
}
```

## Missed Call Notification Flow

The following diagram shows the typical flow for an incoming call that goes unanswered:

```
Incoming Push
    │
    ▼
CallKit / ConnectionService UI
    │
    ▼
callState$: RINGING ──────────────────────────────┐
    │                                                │
    │  (user does not answer)                        │
    ▼                                                │
callState$: ENDED/FAILED/DROPPED  ◄── terminal state │
    │                                                │
    ▼                                                │
App detects: wasActive === false                     │
    │                                                │
    ▼                                                │
Show "Missed Call" notification / UI                 │
```

### Example: Complete Missed Call Flow

```tsx
import React from 'react';
import { View, Text } from 'react-native';
import {
  TelnyxVoiceApp,
  createTelnyxVoipClient,
  CallStateHelpers,
} from '@telnyx/react-voice-commons-sdk';

const voipClient = createTelnyxVoipClient({
  enableAppStateManagement: true,
  debug: true,
});

function AppContent() {
  const [missedCalls, setMissedCalls] = React.useState([]);

  React.useEffect(() => {
    const innerSubs = [];

    const callSub = voipClient.activeCall$.subscribe((call) => {
      if (!call) return;

      // Initialize wasActive from the call's current state to avoid
      // missing a quick RINGING→ACTIVE transition before the next render
      let wasActive = CallStateHelpers.isActive(call.currentState);

      const stateSub = call.callState$.subscribe((state) => {
        if (CallStateHelpers.isActive(state)) {
          wasActive = true;
        }
        if (CallStateHelpers.isTerminated(state) && !wasActive) {
          setMissedCalls((prev) => [...prev, call]);
        }
      });

      innerSubs.push(stateSub);
    });

    return () => {
      callSub.unsubscribe();
      innerSubs.forEach((s) => s.unsubscribe());
    };
  }, []);

  return (
    <View>
      {missedCalls.length > 0 && (
        <Text>{missedCalls.length} missed call(s)</Text>
      )}
    </View>
  );
}

export default function App() {
  return (
    <TelnyxVoiceApp voipClient={voipClient} enableAutoReconnect={true}>
      <AppContent />
    </TelnyxVoiceApp>
  );
}
```

## Relationship to Push Notification Lifecycle

Missed call detection interacts with the push notification system described in [Push Notification App Setup](../push-notification/app-setup.md):

- **Push-launched cold starts**: When the OS wakes your app for an incoming call, the SDK handles login automatically. If the user does not answer, the call transitions to a terminal state (`ENDED`, `FAILED`, or `DROPPED`) and your app can record the missed state.
- **Background state**: If your app is in the background when the call comes in, CallKit (iOS) or ConnectionService (Android) shows the native incoming-call UI. If the call is missed, the SDK delivers the terminal state when your app returns to the foreground.
- **Double-login guard**: Make sure you follow the guidance in [Push Notification App Setup](../push-notification/app-setup.md) about avoiding double-login on push-launched cold starts. A double-login can cause the call to disconnect prematurely, which would incorrectly register as a "missed" call.

## Common Pitfalls

- **Treating every ENDED call as missed.** A call that was answered and then hung up normally is not missed. Always check whether the call ever reached the `ACTIVE` state before flagging it as missed.
- **Only checking for `ENDED` state.** A missed call can also end in `FAILED` or `DROPPED` states (e.g., network drop before answer). Use `CallStateHelpers.isTerminated(state)` to catch all terminal states, not just `ENDED`.
- **Not unsubscribing from callState$.** The observable is hot — if you create subscriptions in `useEffect` without cleaning them up, you will get stale updates or duplicate missed-call entries.
- **Missing the ACTIVE transition.** If your subscription starts after the call is already `ACTIVE` (for example, due to a slow render), you may miss the transition. Check `call.currentState` when you first subscribe and set your `wasActive` flag accordingly:

```tsx
React.useEffect(() => {
  let wasActive = CallStateHelpers.isActive(call.currentState);
  // ... subscribe as shown above
}, [call]);
```

- **Not resetting `missed` state when the call prop changes.** When using a hook like `useMissedCallDetector(call)`, the `missed` state from a previous call persists if the component receives a new `call` prop. Always reset the state at the start of the `useEffect` that depends on `call`:

```tsx
React.useEffect(() => {
  setMissed(false); // Reset for each new call
  let wasActive = CallStateHelpers.isActive(call.currentState);
  // ... subscribe to callState$
}, [call]);
```

Without this reset, if call A was missed (`missed = true`), the hook immediately returns `true` for call B — even before call B is answered or terminated.

- **Assuming ENDED means the caller hung up.** The `ENDED` state covers all termination reasons — caller hang-up, callee rejection, network error, or timeout. The SDK does not currently expose a termination reason property on the `Call` object. If you need to distinguish between these, use server-side call detail records (CDRs) via the Telnyx API.

## See Also

- [Push Notification App Setup](../push-notification/app-setup.md) — configuring push notifications for incoming calls
- [Push Notification Portal Setup](../push-notification/portal-setup.md) — Telnyx portal configuration for push certificates
- [DTMF](./dtmf.md) — sending DTMF tones during an active call
- iOS Missed Call Notifications — iOS-specific guide with CallKit integration (link will work once the iOS guide is merged)
- [Error Handling](../error-handling/ErrorHandling.md) — handling call errors and reconnection
