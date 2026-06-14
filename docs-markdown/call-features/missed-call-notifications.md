# Missed Call Notification Handling

When an incoming call is not answered, your app needs to detect the missed state and present it to the user. The Telnyx React Voice Commons SDK exposes call lifecycle events that make it straightforward to track missed calls and display appropriate UI.

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
import { TelnyxCallState } from '@telnyx/react-voice-commons-sdk';

function useMissedCallDetector(call: Call) {
  const [missed, setMissed] = React.useState(false);

  React.useEffect(() => {
    let wasActive = false;

    const sub = call.callState$.subscribe((state) => {
      if (state === TelnyxCallState.ACTIVE) {
        wasActive = true;
      }

      if (
        state === TelnyxCallState.ENDED &&
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

1. `wasActive` starts as `false`
2. If the call ever reaches `ACTIVE`, we set `wasActive = true`
3. When the call ends (`ENDED`) and `wasActive` is still `false`, the call was never answered — it was missed

### Using the Active Call Stream

For app-wide missed call detection, monitor `voipClient.activeCall$`:

```tsx
import {
  TelnyxVoipClient,
  TelnyxCallState,
} from '@telnyx/react-voice-commons-sdk';

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
    const sub = voipClient.activeCall$.subscribe((call) => {
      if (call && call !== previousCallRef.current) {
        // New call appeared
        previousCallRef.current = call;
        wasActiveRef.current = false;

        // Subscribe to the new call's state
        const stateSub = call.callState$.subscribe((state) => {
          if (state === TelnyxCallState.ACTIVE) {
            wasActiveRef.current = true;
          }
          if (state === TelnyxCallState.ENDED && !wasActiveRef.current) {
            onMissedCall(call);
          }
        });

        call.callState$
          .pipe(filter((s) => s === TelnyxCallState.ENDED))
          .subscribe(() => stateSub.unsubscribe());
      }
    });

    return () => sub.unsubscribe();
  }, [voipClient, onMissedCall]);

  return null;
}
```

## Displaying Missed Call Information

Once you have detected a missed call, you can display it in your UI:

```tsx
function CallHistoryItem({ call, wasMissed }: { call: Call; wasMissed: boolean }) {
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
          {call.callerName || call.callerNumber || 'Unknown'}
        </Text>
        <Text style={[styles.status, wasMissed && styles.missedText]}>
          {wasMissed ? 'Missed' : 'Answered'}
        </Text>
      </View>
      <Text style={styles.timestamp}>
        {formatTimestamp(call.startedAt)}
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
callState$: ENDED  ◄── caller hangs up or timeout   │
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
import { View, Text, Button } from 'react-native';
import {
  TelnyxVoiceApp,
  createTelnyxVoipClient,
  TelnyxCallState,
} from '@telnyx/react-voice-commons-sdk';

const voipClient = createTelnyxVoipClient({
  enableAppStateManagement: true,
  debug: true,
});

function AppContent() {
  const [activeCall, setActiveCall] = React.useState(null);
  const [missedCalls, setMissedCalls] = React.useState([]);
  const [wasActive, setWasActive] = React.useState(false);

  React.useEffect(() => {
    const callSub = voipClient.activeCall$.subscribe((call) => {
      setActiveCall(call);
      if (call) {
        setWasActive(false);
      }
    });
    return () => callSub.unsubscribe();
  }, []);

  React.useEffect(() => {
    if (!activeCall) return;

    const stateSub = activeCall.callState$.subscribe((state) => {
      if (state === TelnyxCallState.ACTIVE) {
        setWasActive(true);
      }
      if (state === TelnyxCallState.ENDED) {
        if (!wasActive) {
          setMissedCalls((prev) => [...prev, activeCall]);
        }
      }
    });

    return () => stateSub.unsubscribe();
  }, [activeCall, wasActive]);

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

- **Push-launched cold starts**: When the OS wakes your app for an incoming call, the SDK handles login automatically. If the user does not answer, the call transitions to `ENDED` and your app can record the missed state.
- **Background state**: If your app is in the background when the call comes in, CallKit (iOS) or ConnectionService (Android) shows the native incoming-call UI. If the call is missed, the SDK delivers the `ENDED` state when your app returns to the foreground.
- **Double-login guard**: Make sure you follow the guidance in [Push Notification App Setup](../push-notification/app-setup.md) about avoiding double-login on push-launched cold starts. A double-login can cause the call to disconnect prematurely, which would incorrectly register as a "missed" call.

## Common Pitfalls

- **Treating every ENDED call as missed.** A call that was answered and then hung up normally is not missed. Always check whether the call ever reached the `ACTIVE` state before flagging it as missed.
- **Not unsubscribing from callState$.** The observable is hot — if you create subscriptions in `useEffect` without cleaning them up, you will get stale updates or duplicate missed-call entries.
- **Missing the ACTIVE transition.** If your subscription starts after the call is already `ACTIVE` (for example, due to a slow render), you may miss the transition. Check `call.currentState` when you first subscribe and set your `wasActive` flag accordingly:

```tsx
React.useEffect(() => {
  let wasActive = call.currentState === TelnyxCallState.ACTIVE;
  // ... subscribe as shown above
}, [call]);
```

- **Assuming ENDED means the caller hung up.** The `ENDED` state covers all termination reasons — caller hang-up, callee rejection, network error, or timeout. If you need to distinguish between these, check the `endReason` property on the `Call` object when availabel.

## See Also

- [Push Notification App Setup](../push-notification/app-setup.md) — configuring push notifications for incoming calls
- [Push Notification Portal Setup](../push-notification/portal-setup.md) — Telnyx portal configuration for push certificates
- [DTMF](./dtmf.md) — sending DTMF tones during an active call
- [Error Handling](../error-handling/ErrorHandling.md) — handling call errors and reconnection
