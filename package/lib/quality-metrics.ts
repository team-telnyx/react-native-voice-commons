/**
 * Call quality metrics types for React Voice Commons.
 *
 * These mirror the call quality telemetry of the native SDKs (iOS
 * `CallQualityMetrics` / `MOSCalculator`, Android `MOSCalculator`): the same
 * MOS formula, quality bands, and `unknown` handling, so one call reports the
 * same score and rating on every platform.
 *
 * @module quality-metrics
 */

/**
 * Quality rating derived from the MOS score (same bands as iOS and Android).
 *
 * - EXCELLENT: MOS > 4.2
 * - GOOD:      4.1 <= MOS <= 4.2
 * - FAIR:      3.7 <= MOS < 4.1
 * - POOR:      3.1 <= MOS < 3.7
 * - BAD:       MOS < 3.1
 * - UNKNOWN:   MOS could not be calculated (missing jitter or RTT)
 */
export enum CallQualityLevel {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  BAD = 'bad',
  UNKNOWN = 'unknown',
}

/** A raw WebRTC stats report, copied as a plain object. */
export type QualityStatsRecord = Record<string, unknown>;

/**
 * Snapshot of call quality metrics at a single sampling point. Field names and
 * units match iOS `CallQualityMetrics`.
 */
export interface CallQualityMetrics {
  /** The call identifier this metrics snapshot belongs to. */
  callId: string;
  /** ISO-8601 timestamp of when the metrics were collected. */
  timestamp: string;
  /** Jitter in seconds, or null when unavailable. */
  jitter: number | null;
  /** Round-trip time in seconds, or null when unavailable. */
  rtt: number | null;
  /** Mean Opinion Score (1.0–5.0), or null when it cannot be calculated. */
  mos: number | null;
  /** Quality rating derived from `mos`; UNKNOWN when `mos` is null. */
  quality: CallQualityLevel;
  /** Instantaneous inbound (remote) audio level, 0.0–1.0. */
  inboundAudioLevel: number;
  /** Instantaneous outbound (local) audio level, 0.0–1.0. */
  outboundAudioLevel: number;
  /** Raw `inbound-rtp` audio stats, or null when unavailable. */
  inboundAudio: QualityStatsRecord | null;
  /** Raw `outbound-rtp` audio stats, or null when unavailable. */
  outboundAudio: QualityStatsRecord | null;
  /** Raw `remote-inbound-rtp` audio stats, or null when unavailable. */
  remoteInboundAudio: QualityStatsRecord | null;
  /** Raw `remote-outbound-rtp` audio stats, or null when unavailable. */
  remoteOutboundAudio: QualityStatsRecord | null;
}

/**
 * Configuration options for the quality metrics collector.
 */
export interface QualityMetricsCollectorOptions {
  /** The RTCPeerConnection to collect stats from. */
  peerConnection: any;
  /** The call identifier to include in each metrics snapshot. */
  callId: string;
  /** Polling interval in milliseconds. Default: 200 (iOS parity). */
  intervalMs?: number;
}

const R0 = 93.2; // Base value for the G.711 codec

/**
 * Calculate the Mean Opinion Score with the simplified E-model used by the
 * iOS and Android SDKs.
 *
 * @param jitterMs - Jitter in milliseconds.
 * @param rttMs - Round-trip time in milliseconds.
 * @param packetsReceived - Packets received in the sampling interval.
 * @param packetsLost - Packets lost in the sampling interval.
 * @returns MOS in the inclusive range 1.0–5.0, or NaN when an input is
 *   non-finite or the computation overflows. Pair it with {@link getQuality},
 *   which maps NaN to UNKNOWN.
 */
export function calculateMOS(
  jitterMs: number,
  rttMs: number,
  packetsReceived: number,
  packetsLost: number
): number {
  // A missing jitter/RTT must report UNKNOWN rather than a clamped score.
  if (!Number.isFinite(jitterMs) || !Number.isFinite(rttMs)) {
    return NaN;
  }

  const Id = calculateDelayImpairment(jitterMs, rttMs);
  const Ie = calculateEquipmentImpairment(packetsLost, packetsReceived);
  const R = R0 - Id - Ie;

  // ITU-T G.107: R < 0 maps to MOS 1. Without this guard the cubic term turns
  // back upward for very negative R, so ~1.2s of one-way latency would clamp
  // to 5.0 (EXCELLENT). The native SDKs currently lack this guard.
  if (R < 0) {
    return 1;
  }

  const mos = 1 + 0.035 * R + 0.000007 * R * (R - 60) * (100 - R);
  if (!Number.isFinite(mos)) {
    return NaN;
  }
  return Math.min(Math.max(mos, 1), 5);
}

/**
 * Map a MOS score to a quality rating. Non-finite input is UNKNOWN; finite
 * values map to exactly one band.
 */
export function getQuality(mos: number | null): CallQualityLevel {
  if (mos == null || !Number.isFinite(mos)) {
    return CallQualityLevel.UNKNOWN;
  }
  if (mos > 4.2) return CallQualityLevel.EXCELLENT;
  if (mos >= 4.1) return CallQualityLevel.GOOD;
  if (mos >= 3.7) return CallQualityLevel.FAIR;
  if (mos >= 3.1) return CallQualityLevel.POOR;
  return CallQualityLevel.BAD;
}

/** Delay impairment (Id) from one-way latency, approximated as jitter + RTT/2. */
function calculateDelayImpairment(jitterMs: number, rttMs: number): number {
  const latency = jitterMs + rttMs / 2;
  return 0.024 * latency + 0.11 * (latency - 177.3) * (latency > 177.3 ? 1 : 0);
}

/** Equipment impairment (Ie) from the packet loss percentage in the interval. */
function calculateEquipmentImpairment(packetsLost: number, packetsReceived: number): number {
  const total = packetsReceived + packetsLost;
  if (total <= 0) {
    return 0;
  }
  const packetLossPercentage = (packetsLost / total) * 100;
  return 20 * Math.log(1 + packetLossPercentage);
}
