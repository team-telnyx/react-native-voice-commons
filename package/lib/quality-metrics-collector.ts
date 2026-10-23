import log from 'loglevel';
import type {
  CallQualityMetrics,
  QualityMetricsCollectorOptions,
  QualityStatsRecord,
} from './quality-metrics';
import { calculateMOS, getQuality } from './quality-metrics';

/** iOS samples every 0.2s so audio levels can drive a live level meter. */
export const DEFAULT_QUALITY_METRICS_INTERVAL_MS = 200;

/**
 * QualityMetricsCollector polls WebRTC `getStats()` on the peer connection and
 * emits a {@link CallQualityMetrics} snapshot per sample, computed the same way
 * as the iOS `WebRTCStatsReporter`:
 *
 * - jitter/RTT come from `remote-inbound-rtp` (RTCP); when the platform has not
 *   reported it yet, local `inbound-rtp` jitter and the nominated candidate
 *   pair RTT are used instead
 * - packet loss is measured per sample (delta since the previous sample)
 * - a missing jitter or RTT yields `mos: null` and `quality: UNKNOWN`
 */
export class QualityMetricsCollector {
  private peerConnection: any;
  private callId: string;
  private intervalMs: number;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private collecting = false;
  private previousPackets: { received: number; lost: number } | null = null;

  /** Called with the latest metrics snapshot on each sample. */
  public onMetrics: ((metrics: CallQualityMetrics) => void) | null = null;

  constructor(options: QualityMetricsCollectorOptions) {
    this.peerConnection = options.peerConnection;
    this.callId = options.callId;
    this.intervalMs = options.intervalMs ?? DEFAULT_QUALITY_METRICS_INTERVAL_MS;
  }

  /**
   * Start collection, taking the first sample immediately.
   * Idempotent — calling `start()` twice is a no-op.
   */
  start(): void {
    if (this.started) {
      log.debug('[QualityMetricsCollector] Already started');
      return;
    }
    if (!this.peerConnection) {
      log.warn('[QualityMetricsCollector] Cannot start: no peer connection');
      return;
    }

    this.started = true;
    log.debug('[QualityMetricsCollector] Starting quality metrics collection', {
      callId: this.callId,
      intervalMs: this.intervalMs,
    });

    this.sample();
    this.timerId = setInterval(() => this.sample(), this.intervalMs);
  }

  /**
   * Stop collection. Idempotent — safe to call when not running.
   */
  stop(): void {
    if (!this.started) return;

    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    this.started = false;
    this.previousPackets = null;
    log.debug('[QualityMetricsCollector] Stopped quality metrics collection');
  }

  /**
   * Check if the collector is currently active.
   */
  isActive(): boolean {
    return this.started;
  }

  private sample(): void {
    // A slow getStats() must not stack overlapping reads at short intervals.
    if (this.collecting) return;
    this.collecting = true;
    this.collect()
      .catch((err) => {
        log.error('[QualityMetricsCollector] Error collecting metrics:', err);
      })
      .finally(() => {
        this.collecting = false;
      });
  }

  /**
   * Collect a single metrics snapshot from the peer connection.
   */
  private async collect(): Promise<void> {
    if (!this.started || !this.peerConnection) return;

    let stats: any;
    try {
      stats = await this.peerConnection.getStats();
    } catch (err) {
      log.error('[QualityMetricsCollector] getStats() failed:', err);
      return;
    }

    if (!stats || !this.started) return;

    let inbound: QualityStatsRecord | null = null;
    let outbound: QualityStatsRecord | null = null;
    let remoteInbound: QualityStatsRecord | null = null;
    let remoteOutbound: QualityStatsRecord | null = null;
    let mediaSourceAudioLevel: number | null = null;
    let nominatedRtt: number | null = null;
    let fallbackRtt: number | null = null;

    stats.forEach((report: any) => {
      if (!report) return;
      switch (report.type) {
        case 'inbound-rtp':
          if (report.kind === 'audio') inbound = { ...report };
          break;
        case 'outbound-rtp':
          if (report.kind === 'audio') outbound = { ...report };
          break;
        case 'remote-inbound-rtp':
          if (report.kind === 'audio') remoteInbound = { ...report };
          break;
        case 'remote-outbound-rtp':
          if (report.kind === 'audio') remoteOutbound = { ...report };
          break;
        case 'media-source':
          if (report.kind === 'audio' && typeof report.audioLevel === 'number') {
            mediaSourceAudioLevel = report.audioLevel;
          }
          break;
        case 'candidate-pair':
          if (typeof report.currentRoundTripTime === 'number') {
            if (report.nominated) {
              nominatedRtt = report.currentRoundTripTime;
            } else if (report.state === 'succeeded' && fallbackRtt == null) {
              fallbackRtt = report.currentRoundTripTime;
            }
          }
          break;
      }
    });

    const jitter = numberOrNull(remoteInbound, 'jitter') ?? numberOrNull(inbound, 'jitter');
    const rtt = numberOrNull(remoteInbound, 'roundTripTime') ?? nominatedRtt ?? fallbackRtt;

    const packetsReceived = numberOrNull(inbound, 'packetsReceived') ?? 0;
    const packetsLost = numberOrNull(inbound, 'packetsLost') ?? 0;
    let deltaReceived = packetsReceived;
    let deltaLost = packetsLost;
    if (this.previousPackets) {
      deltaReceived = Math.max(0, packetsReceived - this.previousPackets.received);
      deltaLost = Math.max(0, packetsLost - this.previousPackets.lost);
    }
    this.previousPackets = { received: packetsReceived, lost: packetsLost };

    const mos =
      jitter != null && rtt != null
        ? calculateMOS(jitter * 1000, rtt * 1000, deltaReceived, deltaLost)
        : NaN;

    const metrics: CallQualityMetrics = {
      callId: this.callId,
      timestamp: new Date().toISOString(),
      jitter,
      rtt,
      mos: Number.isFinite(mos) ? mos : null,
      quality: getQuality(mos),
      inboundAudioLevel: numberOrNull(inbound, 'audioLevel') ?? 0,
      outboundAudioLevel:
        mediaSourceAudioLevel ?? numberOrNull(outbound, 'audioLevel') ?? 0,
      inboundAudio: inbound,
      outboundAudio: outbound,
      remoteInboundAudio: remoteInbound,
      remoteOutboundAudio: remoteOutbound,
    };

    this.onMetrics?.(metrics);
  }
}

function numberOrNull(record: QualityStatsRecord | null, key: string): number | null {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
