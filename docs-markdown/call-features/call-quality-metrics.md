# Call Quality Metrics

The Telnyx React Voice Commons SDK exposes real-time call quality metrics derived from WebRTC `getStats()` reports. These metrics provide application-level visibility into network and audio quality during active calls, enabling UI indicators, adaptive behavior, and diagnostic logging.

## Overview

Quality metrics are collected automatically while a call is active. The underlying SDK polls `RTCPeerConnection.getStats()` at a configurable interval (default: 5 seconds), normalizes the raw WebRTC report into a structured `CallQualityMetrics` object, and delivers it via:

- **Callback**: `call.onQualityMetrics` on the core SDK `Call` object.
- **Observable**: `call.qualityMetrics$` on the React wrapper `Call` model.

Both delivery mechanisms receive the same `CallQualityMetrics` snapshot.

## API

### Core SDK (`@telnyx/react-native-voice-sdk`)

```ts
import type { CallQualityMetrics, CallQualityLevel } from '@telnyx/react-native-voice-sdk';

// Register a callback on the Call object
call.onQualityMetrics = (metrics: CallQualityMetrics) => {
  console.log('Quality:', metrics.qualityLevel, 'MOS:', metrics.mos);
};

// Manual control (auto-managed by call lifecycle)
call.startQualityMetrics(intervalMs?: number);
call.stopQualityMetrics();
call.isQualityMetricsActive(): boolean;
call.getQualityMetrics(): CallQualityMetrics | null;
```

### React Wrapper (`@telnyx/react-voice-commons-sdk`)

```ts
import type { CallQualityMetrics } from '@telnyx/react-voice-commons-sdk';

// Subscribe to the observable stream
call.qualityMetrics$.subscribe((metrics: CallQualityMetrics | null) => {
  if (metrics) {
    console.log('Quality:', metrics.qualityLevel, 'MOS:', metrics.mos);
  }
});

// Synchronous access
const current = call.currentQualityMetrics;
```

## CallQualityMetrics

| Field             | Type                           | Description                                                        |
| ----------------- | ------------------------------ | ------------------------------------------------------------------ |
| `callId`          | `string`                       | The call identifier this snapshot belongs to.                     |
| `timestamp`       | `string` (ISO-8601)            | When the metrics were collected.                                  |
| `qualityLevel`    | `CallQualityLevel`             | Derived quality classification (EXCELLENT / GOOD / FAIR / POOR / BAD). |
| `mos`             | `number \| null`              | Estimated Mean Opinion Score (1.0-4.5), or null when insufficient data. |
| `jitter`          | `number \| null`              | Average jitter in milliseconds, or null when unavailable.        |
| `roundTripTime`   | `number \| null`              | Round-trip time in milliseconds, or null when unavailable.         |
| `packetLossRate`  | `number \| null`              | Packet loss as a percentage (0-100), or null when unavailable.     |
| `inbound`         | `AudioInboundQualityStats \| null` | Normalized inbound audio stats, or null when no inbound audio. |
| `outbound`        | `AudioOutboundQualityStats \| null` | Normalized outbound audio stats, or null when no outbound audio. |

### AudioInboundQualityStats

| Field            | Type               | Description                                                    |
| ---------------- | ------------------ | ------------------------------------------------------------- |
| `packetsReceived` | `number`          | Total RTP packets received.                                  |
| `packetsLost`    | `number`          | Total RTP packets reported as lost.                           |
| `jitter`         | `number \| null`  | Average jitter in milliseconds, or null.                     |
| `audioLevel`     | `number \| null`  | Average audio level (0-1, RFC 6464), or null.               |
| `bitrateAvg`     | `number \| null`  | Average bitrate in bits per second, or null for first sample. |

### AudioOutboundQualityStats

| Field           | Type               | Description                                                    |
| --------------- | ------------------ | ------------------------------------------------------------- |
| `packetsSent`   | `number`          | Total RTP packets sent.                                      |
| `audioLevel`    | `number \| null`  | Average audio level (0-1, RFC 6464), or null.               |
| `bitrateAvg`    | `number \| null`  | Average bitrate in bits per second, or null for first sample. |

## CallQualityLevel

| Level      | MOS Range   | Description                                              |
| ---------- | ----------- | -------------------------------------------------------- |
| EXCELLENT  | >= 4.0      | Indistinguishable from a direct connection.            |
| GOOD       | >= 3.6      | Minor impairments that do not affect conversation flow. |
| FAIR       | >= 3.1      | Noticeable degradation but conversation remains possible. |
| POOR       | >= 2.6      | Significant degradation; communication is difficult.   |
| BAD        | < 2.6       | Severe degradation; communication is nearly impossible. |

## MOS Estimation

The SDK uses a simplified E-model (ITU-T G.107) to estimate MOS from network impairments:

1. **Latency impairment** (`Id`): computed from RTT + jitter buffer delay.
2. **Equipment impairment** (`Ie`): simplified codec + packet loss model.
3. **Rating factor** (`R = 93.2 - Id - Ie`), mapped to the 1-4.5 MOS scale.

When both jitter and RTT are null, MOS is null and `qualityLevel` defaults to `FAIR`.

## Lifecycle

Quality metrics collection is **automatic**:

- **Starts** when the call transitions to the `active` state (alongside the call report collector).
- **Stops** when the call transitions to `dropped` or `ended`, or when the call is hung up.
- No manual intervention is required for normal call flows.

You can also manually control collection via `startQualityMetrics()` / `stopQualityMetrics()` if you need a custom interval or want to pause/resume collection.

## Null Normalization

Missing WebRTC stats fields are reported as `null` (not `undefined` or `0`) so consumers can serialize and consume the metrics without guarding every field. The `packetsReceived`, `packetsLost`, and `packetsSent` counters default to `0` when the platform omits them.

## Usage Example

```tsx
import { useTelnyxVoice } from '@telnyx/react-voice-commons-sdk';
import { useEffect } from 'react';
import { CallQualityLevel } from '@telnyx/react-voice-commons-sdk';

function CallQualityIndicator() {
  const { currentCall } = useTelnyxVoice();

  useEffect(() => {
    if (!currentCall) return;

    const sub = currentCall.qualityMetrics$.subscribe((metrics) => {
      if (!metrics) return;

      switch (metrics.qualityLevel) {
        case CallQualityLevel.EXCELLENT:
        case CallQualityLevel.GOOD:
          console.log('Call quality is good');
          break;
        case CallQualityLevel.FAIR:
          console.warn('Call quality is fair');
          break;
        case CallQualityLevel.POOR:
        case CallQualityLevel.BAD:
          console.error('Call quality is poor');
          break;
      }
    });

    return () => sub.unsubscribe();
  }, [currentCall]);

  return null;
}
```
