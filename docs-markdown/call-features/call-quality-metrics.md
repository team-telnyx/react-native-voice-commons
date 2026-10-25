# Call Quality Metrics

The Telnyx React Voice Commons SDK can deliver real-time call quality metrics derived from WebRTC `getStats()` reports: a Mean Opinion Score (MOS), a quality rating, jitter, round-trip time, and audio levels. Use them for quality indicators, audio level meters, adaptive behavior, or diagnostic logging.

The metrics match the iOS and Android SDKs: the same MOS formula, the same quality bands, and the same field names and units, so one call reports the same score and rating on every platform.

## Enabling Quality Metrics

Quality metrics are **off by default**. Turn them on with `enableQualityMetrics` (or `debug`, which also enables them):

```ts
// React wrapper: in the login config
await voipClient.login(
  createCredentialConfig('sip-user', 'sip-password', {
    enableQualityMetrics: true,
  })
);

// Core SDK: in the client options
const client = new TelnyxRTC({ login_token: 'token', enableQualityMetrics: true });
```

When enabled, collection starts automatically when a call becomes `active` and stops when it is hung up, `ended`, or `dropped`, or when its peer connection is replaced (for example by a reattach). Snapshots are sampled immediately and then every 200 ms, as on iOS.

## API

### React Wrapper (`@telnyx/react-voice-commons-sdk`)

```ts
import type { CallQualityMetrics } from '@telnyx/react-voice-commons-sdk';

// Observable stream: emits null initially, then each snapshot
call.qualityMetrics$.subscribe((metrics: CallQualityMetrics | null) => {
  if (metrics) {
    console.log('Quality:', metrics.quality, 'MOS:', metrics.mos);
  }
});

// Synchronous access to the latest snapshot
const current = call.currentQualityMetrics;
```

### Core SDK (`@telnyx/react-native-voice-sdk`)

```ts
import type { CallQualityMetrics } from '@telnyx/react-native-voice-sdk';

// Callback (equivalent to iOS `onCallQualityChange`)
call.onQualityMetrics = (metrics: CallQualityMetrics) => {
  console.log('Quality:', metrics.quality, 'MOS:', metrics.mos);
};

// Event: any number of listeners
call.on('telnyx.call.qualityMetrics', (metrics: CallQualityMetrics) => {});

// Manual control: collect without enableQualityMetrics, or at a custom interval
call.startQualityMetrics(intervalMs?: number);
call.stopQualityMetrics();
call.isQualityMetricsActive(): boolean;
call.getQualityMetrics(): CallQualityMetrics | null;
```

## CallQualityMetrics

| Field                 | Type                         | Description                                                    |
| --------------------- | ---------------------------- | -------------------------------------------------------------- |
| `callId`              | `string`                     | The call this snapshot belongs to.                             |
| `timestamp`           | `string` (ISO-8601)          | When the snapshot was collected.                               |
| `jitter`              | `number \| null`             | Jitter in **seconds**, or null when unavailable.               |
| `rtt`                 | `number \| null`             | Round-trip time in **seconds**, or null when unavailable.      |
| `mos`                 | `number \| null`             | Mean Opinion Score (1.0–5.0), or null when it cannot be calculated. |
| `quality`             | `CallQualityLevel`           | Rating derived from `mos`; `UNKNOWN` when `mos` is null.       |
| `inboundAudioLevel`   | `number`                     | Instantaneous remote audio level (0.0–1.0).                    |
| `outboundAudioLevel`  | `number`                     | Instantaneous local audio level (0.0–1.0).                     |
| `inboundAudio`        | `QualityStatsRecord \| null` | Raw `inbound-rtp` audio stats.                                 |
| `outboundAudio`       | `QualityStatsRecord \| null` | Raw `outbound-rtp` audio stats.                                |
| `remoteInboundAudio`  | `QualityStatsRecord \| null` | Raw `remote-inbound-rtp` audio stats.                          |
| `remoteOutboundAudio` | `QualityStatsRecord \| null` | Raw `remote-outbound-rtp` audio stats.                         |

## CallQualityLevel

| Level       | MOS              |
| ----------- | ---------------- |
| `EXCELLENT` | > 4.2            |
| `GOOD`      | 4.1 – 4.2        |
| `FAIR`      | 3.7 – < 4.1      |
| `POOR`      | 3.1 – < 3.7      |
| `BAD`       | < 3.1            |
| `UNKNOWN`   | MOS unavailable  |

## How MOS Is Calculated

The SDK uses the same simplified E-model (ITU-T G.107) as the iOS and Android SDKs:

1. **Inputs**: jitter and RTT from `remote-inbound-rtp` (RTCP). Until the platform reports it, local `inbound-rtp` jitter and the nominated candidate pair RTT are used instead. Packet loss is measured per sample, so an early loss burst does not affect the rest of the call.
2. **Delay impairment** `Id` from one-way latency, approximated as `jitter + rtt / 2`.
3. **Equipment impairment** `Ie = 20 · ln(1 + loss %)`.
4. **Rating factor** `R = 93.2 − Id − Ie`, mapped to MOS with `1 + 0.035R + 7·10⁻⁶·R(R − 60)(100 − R)` and clamped to 1.0–5.0. A negative `R` (extreme latency) is reported as MOS 1.0, per G.107.

When jitter or RTT is unavailable, `mos` is `null` and `quality` is `UNKNOWN`.

## Usage Example

```tsx
import { useEffect } from 'react';
import { CallQualityLevel, useTelnyxVoice } from '@telnyx/react-voice-commons-sdk';

function CallQualityIndicator() {
  const { currentCall } = useTelnyxVoice();

  useEffect(() => {
    if (!currentCall) return;

    const sub = currentCall.qualityMetrics$.subscribe((metrics) => {
      if (!metrics) return;

      switch (metrics.quality) {
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
        case CallQualityLevel.UNKNOWN:
          break;
      }
    });

    return () => sub.unsubscribe();
  }, [currentCall]);

  return null;
}
```

## See Also

- [Sending DTMF Tones](./dtmf.md) — Send DTMF tones during an active call.
- [Trickle ICE](./trickle-ice.md) — ICE candidate gathering for NAT traversal.
