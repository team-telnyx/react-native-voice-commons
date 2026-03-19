# Call Quality Reporting & Debug Stats

The Telnyx React Native Voice SDK provides two complementary systems for monitoring and debugging call quality: **Call Reports** (HTTP-based quality reporting) and **Debug Stats** (WebSocket-based real-time diagnostics). Both are opt-in and disabled by default.

## Table of Contents

- [Overview](#overview)
- [Call Reports (v2)](#call-reports-v2)
  - [Enabling Call Reports](#enabling-call-reports)
  - [Configuration Options](#configuration-options)
  - [What Gets Collected](#what-gets-collected)
  - [Payload Structure](#payload-structure)
  - [Long Call Handling](#long-call-handling)
  - [Using with react-voice-commons-sdk](#using-with-react-voice-commons-sdk)
- [Debug Stats (v1)](#debug-stats-v1)
  - [Enabling Debug Stats](#enabling-debug-stats)
  - [How It Works](#how-it-works)
  - [Debug Stats Events](#debug-stats-events)
- [Choosing Between Call Reports and Debug Stats](#choosing-between-call-reports-and-debug-stats)
- [Privacy & Data Considerations](#privacy--data-considerations)

---

## Overview

| Feature | Call Reports (v2) | Debug Stats (v1) |
|---|---|---|
| **Transport** | HTTP POST to `/call_report` | WebSocket (same connection as signaling) |
| **When sent** | On call end (+ intermediate flushes for long calls) | Real-time during the call |
| **Data** | Aggregated stats intervals + structured logs | Raw WebRTC events and periodic stats |
| **Default** | Disabled (`enableCallReports: false`) | Disabled (`debug: false`) |
| **Use case** | Post-call quality analysis, dashboards | Live debugging, real-time monitoring |

---

## Call Reports (v2)

Call Reports collect WebRTC statistics and structured SDK logs during a call, then POST the data to the Telnyx voice-sdk-proxy `/call_report` endpoint when the call ends. This is useful for building call quality dashboards, diagnosing audio issues after the fact, and monitoring call health across your user base.

### Enabling Call Reports

#### Low-level SDK (`@telnyx/react-native-voice-sdk`)

```typescript
import { TelnyxRTC } from '@telnyx/react-native-voice-sdk';

const client = new TelnyxRTC({
  login_token: 'your-jwt-token',
  enableCallReports: true,
  // Optional: customize collection behavior
  callReportInterval: 5,        // seconds between stats snapshots (default: 5)
  callReportLogLevel: 'debug',  // minimum log level to capture (default: 'debug')
  callReportMaxLogEntries: 1000 // max buffered log entries per call (default: 1000)
});
```

#### High-level SDK (`@telnyx/react-voice-commons-sdk`)

```typescript
import { createCredentialConfig } from '@telnyx/react-voice-commons-sdk';

const config = createCredentialConfig('sip_user', 'sip_password', {
  enableCallReports: true,
  callReportInterval: 5,
  callReportLogLevel: 'info',     // only capture info, warn, error (skip debug)
  callReportMaxLogEntries: 500,
});

await voipClient.login(config);
```

### Configuration Options

| Option | Type | Default | Description |
|---|---|---|---|
| `enableCallReports` | `boolean` | `false` | Enable/disable automatic call quality reporting |
| `callReportInterval` | `number` | `5` | Interval in seconds between WebRTC stats snapshots |
| `callReportLogLevel` | `string` | `'debug'` | Minimum log level to capture. Options: `'debug'`, `'info'`, `'warn'`, `'error'` |
| `callReportMaxLogEntries` | `number` | `1000` | Maximum number of log entries buffered per call. When exceeded, oldest entries are dropped |

**Tuning tips:**

- For production monitoring, use `callReportLogLevel: 'warn'` to reduce payload size and only capture meaningful events
- For debugging specific issues, use `callReportLogLevel: 'debug'` with a higher `callReportMaxLogEntries`
- Lower `callReportInterval` (e.g., `2`) gives finer-grained stats but increases buffer size
- Higher `callReportInterval` (e.g., `10`) reduces overhead but loses granularity

### What Gets Collected

#### Audio Outbound Stats (per interval)

| Metric | Description |
|---|---|
| `packetsSent` | Total RTP packets sent |
| `bytesSent` | Total bytes sent |
| `audioLevelAvg` | Average microphone audio level (0.0 - 1.0) |
| `bitrateAvg` | Average send bitrate in bits/second |

#### Audio Inbound Stats (per interval)

| Metric | Description |
|---|---|
| `packetsReceived` | Total RTP packets received |
| `bytesReceived` | Total bytes received |
| `packetsLost` | Cumulative packets lost |
| `packetsDiscarded` | Packets discarded by jitter buffer |
| `jitterBufferDelay` | Jitter buffer delay in seconds |
| `jitterBufferEmittedCount` | Number of samples emitted from jitter buffer |
| `totalSamplesReceived` | Total audio samples received |
| `concealedSamples` | Samples concealed (packet loss concealment) |
| `concealmentEvents` | Number of concealment events |
| `audioLevelAvg` | Average remote audio level (0.0 - 1.0) |
| `jitterAvg` | Average jitter in milliseconds |
| `bitrateAvg` | Average receive bitrate in bits/second |

#### Connection Stats (per interval)

| Metric | Description |
|---|---|
| `roundTripTimeAvg` | Average round-trip time in seconds |
| `packetsSent` | ICE candidate pair packets sent |
| `packetsReceived` | ICE candidate pair packets received |
| `bytesSent` | ICE candidate pair bytes sent |
| `bytesReceived` | ICE candidate pair bytes received |

#### Structured Logs

Each log entry contains:

```typescript
{
  timestamp: string;   // ISO 8601 UTC timestamp
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;     // Human-readable log message
  context?: object;    // Optional structured context data
}
```

Logs capture SDK-internal events such as:
- Call state transitions
- Peer connection events (ICE candidates, SDP exchanges)
- Network changes during the call
- Error conditions and recovery attempts

### Payload Structure

The final payload POSTed to `/call_report` on call end:

```json
{
  "summary": {
    "callId": "uuid",
    "destinationNumber": "+1234567890",
    "callerNumber": "sip_user",
    "direction": "OUTGOING",
    "state": "done",
    "durationSeconds": 65,
    "telnyxSessionId": "uuid",
    "telnyxLegId": "uuid",
    "sdkVersion": "0.4.0",
    "startTimestamp": "2026-03-19T10:00:00.000Z",
    "endTimestamp": "2026-03-19T10:01:05.000Z"
  },
  "stats": [
    {
      "intervalStartUtc": "2026-03-19T10:00:00.000Z",
      "intervalEndUtc": "2026-03-19T10:00:05.000Z",
      "audio": {
        "outbound": {
          "packetsSent": 250,
          "bytesSent": 40000,
          "audioLevelAvg": 0.0312,
          "bitrateAvg": 64000.0
        },
        "inbound": {
          "packetsReceived": 248,
          "bytesReceived": 39680,
          "packetsLost": 2,
          "packetsDiscarded": 0,
          "jitterBufferDelay": 0.08,
          "jitterBufferEmittedCount": 24000,
          "totalSamplesReceived": 24000,
          "concealedSamples": 320,
          "concealmentEvents": 2,
          "audioLevelAvg": 0.0456,
          "jitterAvg": 15.0,
          "bitrateAvg": 63488.0
        }
      },
      "connection": {
        "roundTripTimeAvg": 0.05,
        "packetsSent": 250,
        "packetsReceived": 248,
        "bytesSent": 40000,
        "bytesReceived": 39680
      }
    }
  ],
  "logs": [
    {
      "timestamp": "2026-03-19T10:00:00.123Z",
      "level": "info",
      "message": "CallReportCollector: Starting stats and log collection",
      "context": { "interval": 5, "logLevel": "debug" }
    }
  ]
}
```

**HTTP headers sent with the request:**

| Header | Description |
|---|---|
| `Content-Type` | `application/json` |
| `x-call-report-id` | Unique identifier for the call report |
| `x-call-id` | The call ID |
| `x-voice-sdk-id` | The voice SDK session ID (if available) |

### Long Call Handling

For calls longer than ~25 minutes, the SDK automatically performs **intermediate flushes** to prevent excessive memory usage:

- **Stats flush threshold**: 300 intervals (~25 min at 5s intervals)
- **Logs flush threshold**: 800 entries

When a threshold is reached:
1. Current stats and logs are drained and sent as a **segment** (with `segment: 0`, `segment: 1`, etc.)
2. Buffers are cleared and collection continues
3. The final report on call end includes only data collected since the last flush

The `segment` field in the payload indicates the order of intermediate flushes. The final payload (without a `segment` field or with the highest segment number) contains the call summary with the complete `state` and `durationSeconds`.

---

## Debug Stats (v1)

Debug Stats send raw WebRTC events and periodic stats over the existing WebSocket connection in real-time. This is useful for live debugging during development or for real-time monitoring dashboards.

### Enabling Debug Stats

#### Low-level SDK

```typescript
const client = new TelnyxRTC({
  login_token: 'your-jwt-token',
  debug: true,  // Enables WebRTC debug stats reporting
});
```

#### High-level SDK

```typescript
const config = createCredentialConfig('sip_user', 'sip_password', {
  debug: true,
});

await voipClient.login(config);
```

### How It Works

When `debug: true` is set:

1. **On call start**: A `debug_report_start` message is sent over the WebSocket with a unique `debug_report_id`
2. **During the call**: `debug_report_data` messages are sent for WebRTC events (ICE candidates, signaling state changes, stats snapshots)
3. **On call end**: A `debug_report_stop` message is sent

All messages include:
- `debug_report_id`: Links all events for a single call
- `debug_report_version`: Protocol version (currently `1`)
- `type`: Message type (`debug_report_start`, `debug_report_data`, `debug_report_stop`)

### Debug Stats Events

The following WebRTC events are captured and sent:

| Event | Tag | Description |
|---|---|---|
| `onsignalingstatechange` | `peer` | Peer connection signaling state changed |
| `onicegatheringstatechange` | `peer` | ICE gathering state changed |
| `onicecandidate` | `peer` | New ICE candidate discovered |
| `ontrack` | `track` | Remote track added |
| `onnegotiationneeded` | `peer` | Renegotiation needed |
| `oniceconnectionstatechange` | `connection` | ICE connection state changed |
| `onicecandidateerror` | `peer` | ICE candidate error occurred |
| `addConnection` | `connection` | Peer connection created |
| `stats` | `stats` | Periodic WebRTC stats snapshot |

Each event includes:
```json
{
  "event": "stats",
  "tag": "stats",
  "peerId": "peer-uuid",
  "connectionId": "connection-uuid",
  "data": { },
  "timestamp": "2026-03-19T10:00:05.000Z",
  "statsObject": { }
}
```

---

## Choosing Between Call Reports and Debug Stats

| Scenario | Recommended |
|---|---|
| Production call quality monitoring | Call Reports |
| Post-call quality analysis | Call Reports |
| Live debugging during development | Debug Stats |
| Diagnosing specific user-reported issues | Both (Call Reports for data, Debug Stats for real-time) |
| Minimal overhead in production | Neither (both disabled by default) |

**You can enable both simultaneously.** They operate independently — Call Reports collect and POST on call end, while Debug Stats stream events in real-time over WebSocket.

```typescript
const client = new TelnyxRTC({
  login_token: 'your-jwt-token',
  debug: true,              // Enable real-time debug stats
  enableCallReports: true,  // Enable post-call quality reports
  callReportLogLevel: 'warn', // Only capture warnings and errors in reports
});
```

---

## Privacy & Data Considerations

- **No audio content is captured** — only metadata and network statistics
- **Log messages** may contain call IDs, phone numbers, and SIP usernames — consider using `callReportLogLevel: 'warn'` or `'error'` in production to minimize PII exposure
- **Call reports are sent to Telnyx infrastructure** (`/call_report` endpoint on the same host as the WebSocket connection)
- **Debug stats are sent over the existing WebSocket** — no additional network connections are opened
- Both features are **disabled by default** and must be explicitly opted into
