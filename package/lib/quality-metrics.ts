/**
 * Call quality metrics types for React Voice Commons.
 *
 * These interfaces expose application-level visibility into network and audio
 * quality during active calls, mirroring the call quality telemetry available
 * in the Android SDK (`team-telnyx/telnyx-webrtc-android`).
 *
 * @module quality-metrics
 */

/**
 * Quality level classification derived from the estimated MOS score.
 *
 * - EXCELLENT: MOS >= 4.0 — call quality is indistinguishable from a direct connection
 * - GOOD:      MOS >= 3.6 — minor impairments that do not affect conversation flow
 * - FAIR:      MOS >= 3.1 — noticeable degradation but conversation remains possible
 * - POOR:      MOS >= 2.6 — significant degradation; communication is difficult
 * - BAD:       MOS <  2.6 — severe degradation; communication is nearly impossible
 */
export enum CallQualityLevel {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  BAD = 'bad',
}

/**
 * Normalized inbound (received) audio quality statistics.
 *
 * All values are extracted from WebRTC `getStats()` reports and normalized so
 * that missing fields are `null` rather than `undefined` or `0`. This makes
 * the interface safe to serialize and consume without guarding every field.
 */
export interface AudioInboundQualityStats {
  /** Total number of RTP packets received for this audio stream. */
  packetsReceived: number;
  /** Total number of RTP packets reported as lost. */
  packetsLost: number;
  /** Average jitter in milliseconds over the sampling interval, or null when unavailable. */
  jitter: number | null;
  /** Average audio level (0–1, RFC 6464), or null when unavailable. */
  audioLevel: number | null;
  /** Average bitrate in bits per second, or null for the first sample. */
  bitrateAvg: number | null;
}

/**
 * Normalized outbound (sent) audio quality statistics.
 */
export interface AudioOutboundQualityStats {
  /** Total number of RTP packets sent for this audio stream. */
  packetsSent: number;
  /** Average audio level (0–1, RFC 6464), or null when unavailable. */
  audioLevel: number | null;
  /** Average bitrate in bits per second, or null for the first sample. */
  bitrateAvg: number | null;
}

/**
 * Snapshot of call quality metrics at a single sampling point.
 *
 * The collector emits this object on each polling interval while a call is
 * active. Consumers can subscribe via the `Call` object's callback or the
 * React wrapper's `qualityMetrics$` observable.
 */
export interface CallQualityMetrics {
  /** The call identifier this metrics snapshot belongs to. */
  callId: string;
  /** ISO-8601 timestamp of when the metrics were collected. */
  timestamp: string;
  /** Derived quality level classification. */
  qualityLevel: CallQualityLevel;
  /** Estimated Mean Opinion Score (1.0–4.5), or null when insufficient data. */
  mos: number | null;
  /** Average jitter in milliseconds, or null when unavailable. */
  jitter: number | null;
  /** Round-trip time in milliseconds, or null when unavailable. */
  roundTripTime: number | null;
  /** Packet loss rate as a percentage (0–100), or null when unavailable. */
  packetLossRate: number | null;
  /** Normalized inbound audio stats, or null when no inbound audio is flowing. */
  inbound: AudioInboundQualityStats | null;
  /** Normalized outbound audio stats, or null when no outbound audio is flowing. */
  outbound: AudioOutboundQualityStats | null;
}

/**
 * Configuration options for the quality metrics collector.
 */
export interface QualityMetricsCollectorOptions {
  /** The RTCPeerConnection to collect stats from. */
  peerConnection: any;
  /** The call identifier to include in each metrics snapshot. */
  callId: string;
  /** Polling interval in milliseconds. Default: 5000 (5 seconds). */
  intervalMs?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Round a number to 4 decimal places, returning null for NaN/null/undefined.
 */
function round4(val: number | null | undefined): number | null {
  if (val == null || isNaN(val)) return null;
  return Math.round(val * 10000) / 10000;
}

/**
 * Compute the arithmetic mean of a non-empty array, or null for empty input.
 */
function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Estimate MOS (Mean Opinion Score) using a simplified E-model.
 *
 * The E-model (ITU-T G.107) maps network impairments to a rating factor R,
 * which is then converted to a 1–5 MOS scale. This simplified version
 * considers latency (RTT + jitter buffer), packet loss rate, and applies
 * the standard R-to-MOS curve.
 *
 * @param jitterMs - Average jitter in milliseconds, or null.
 * @param rttMs - Round-trip time in milliseconds, or null.
 * @param packetLossRate - Packet loss as a percentage (0–100), or null.
 * @returns Estimated MOS (1.0–4.5), or null when both jitter and RTT are null.
 */
export function estimateMOS(
  jitterMs: number | null,
  rttMs: number | null,
  packetLossRate: number | null,
): number | null {
  if (jitterMs == null && rttMs == null) return null;

  const latency = (rttMs ?? 0) + (jitterMs ?? 0) * 2;
  const loss = Math.max(0, packetLossRate ?? 0);

  // Delay impairment (Id) per E-model
  const Id =
    0.024 * latency + 0.11 * (latency > 177.3 ? latency - 177.3 : 0);

  // Equipment impairment (Ie) — simplified codec + loss model
  const Ie = 30 * Math.log10(1 + 0.03 * loss);

  // Rating factor R
  const R = 93.2 - Id - Ie;

  if (R < 0) return 1;
  if (R > 100) return 4.5;

  // R-to-MOS mapping per ITU-T G.107
  return round4(1 + 0.035 * R + 0.0007 * R * (R - 60) * (100 - R));
}

/**
 * Classify a MOS value into a quality level.
 *
 * @param mos - Estimated MOS (1.0–4.5). If null, returns `CallQualityLevel.FAIR`
 *   as a conservative default.
 */
export function qualityLevelFromMOS(mos: number | null): CallQualityLevel {
  if (mos == null) return CallQualityLevel.FAIR;
  if (mos >= 4.0) return CallQualityLevel.EXCELLENT;
  if (mos >= 3.6) return CallQualityLevel.GOOD;
  if (mos >= 3.1) return CallQualityLevel.FAIR;
  if (mos >= 2.6) return CallQualityLevel.POOR;
  return CallQualityLevel.BAD;
}

// Export helpers for testing
export { round4, avg };
