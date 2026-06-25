import log from 'loglevel';
import type { QualityMetricsCollectorOptions } from './quality-metrics';
import {
  CallQualityLevel,
  CallQualityMetrics,
  AudioInboundQualityStats,
  AudioOutboundQualityStats,
  estimateMOS,
  qualityLevelFromMOS,
  round4,
} from './quality-metrics';

const DEFAULT_INTERVAL_MS = 5000;

/**
 * QualityMetricsCollector periodically polls WebRTC `getStats()` on the
 * peer connection, normalizes audio inbound/outbound and connection metrics,
 * estimates a MOS score, and emits a `CallQualityMetrics` snapshot via a
 * callback on every polling interval.
 *
 * The collector never throws when the platform omits individual stats fields —
 * missing values are reported as `null` so consumers can degrade gracefully.
 */
export class QualityMetricsCollector {
  private peerConnection: any;
  private callId: string;
  private intervalMs: number;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private started = false;

  // Previous values for delta calculations
  private prevInboundBytes = 0;
  private prevInboundTimestamp = 0;
  private prevOutboundBytes = 0;
  private prevOutboundTimestamp = 0;

  /** Called with the latest metrics snapshot on each polling interval. */
  public onMetrics: ((metrics: CallQualityMetrics) => void) | null = null;

  constructor(options: QualityMetricsCollectorOptions) {
    this.peerConnection = options.peerConnection;
    this.callId = options.callId;
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  }

  /**
   * Start periodic quality metrics collection.
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

    this.timerId = setInterval(() => {
      this.collect().catch((err) => {
        log.error('[QualityMetricsCollector] Error collecting metrics:', err);
      });
    }, this.intervalMs);
  }

  /**
   * Stop quality metrics collection.
   * Idempotent — safe to call when not running.
   */
  stop(): void {
    if (!this.started) return;

    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    this.started = false;
    log.debug('[QualityMetricsCollector] Stopped quality metrics collection');
  }

  /**
   * Check if the collector is currently active.
   */
  isActive(): boolean {
    return this.started;
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

    if (!stats) return;

    let inbound: AudioInboundQualityStats | null = null;
    let outbound: AudioOutboundQualityStats | null = null;
    let rtt: number | null = null;
    let jitterMs: number | null = null;
    let packetLossRate: number | null = null;

    const inJitters: number[] = [];

    stats.forEach((report: any) => {
      switch (report.type) {
        case 'inbound-rtp':
          if (report.kind === 'audio') {
            const now = report.timestamp;
            const bytes = report.bytesReceived ?? 0;
            let bitrateAvg: number | null = null;
            if (this.prevInboundTimestamp > 0) {
              const timeDelta = now - this.prevInboundTimestamp;
              if (timeDelta > 0) {
                bitrateAvg = ((bytes - this.prevInboundBytes) * 8 * 1000) / timeDelta;
              }
            }
            this.prevInboundBytes = bytes;
            this.prevInboundTimestamp = now;

            // Jitter: WebRTC reports in seconds; convert to ms
            const jitter =
              report.jitter != null ? report.jitter * 1000 : null;
            if (jitter != null) inJitters.push(jitter);

            jitterMs = round4(inJitters.length > 0 ? inJitters[0] : null);

            const packetsReceived = report.packetsReceived ?? 0;
            const packetsLost = report.packetsLost ?? 0;

            if (packetsReceived > 0) {
              packetLossRate = round4(
                (packetsLost / packetsReceived) * 100,
              );
            }

            inbound = {
              packetsReceived,
              packetsLost,
              jitter: jitterMs,
              audioLevel: round4(report.audioLevel ?? null),
              bitrateAvg: round4(bitrateAvg),
            };
          }
          break;

        case 'outbound-rtp':
          if (report.kind === 'audio') {
            const now = report.timestamp;
            const bytes = report.bytesSent ?? 0;
            let bitrateAvg: number | null = null;
            if (this.prevOutboundTimestamp > 0) {
              const timeDelta = now - this.prevOutboundTimestamp;
              if (timeDelta > 0) {
                bitrateAvg = ((bytes - this.prevOutboundBytes) * 8 * 1000) / timeDelta;
              }
            }
            this.prevOutboundBytes = bytes;
            this.prevOutboundTimestamp = now;

            // Audio level may come from the associated media-source report
            let audioLevel: number | null = null;
            if (report.mediaSourceId && typeof stats.get === 'function') {
              const mediaSource = stats.get(report.mediaSourceId);
              if (mediaSource && mediaSource.audioLevel != null) {
                audioLevel = round4(mediaSource.audioLevel);
              }
            }

            outbound = {
              packetsSent: report.packetsSent ?? 0,
              audioLevel,
              bitrateAvg: round4(bitrateAvg),
            };
          }
          break;

        case 'candidate-pair':
          if (report.nominated || report.state === 'succeeded') {
            if (report.currentRoundTripTime != null) {
              // RTT is in seconds; convert to ms
              rtt = round4(report.currentRoundTripTime * 1000);
            }
          }
          break;

        case 'media-source':
          // Fallback: if we haven't found audio level from outbound-rtp
          if (!outbound && report.kind === 'audio' && report.audioLevel != null) {
            outbound = {
              packetsSent: 0,
              audioLevel: round4(report.audioLevel),
              bitrateAvg: null,
            };
          }
          break;
      }
    });

    const mos = estimateMOS(jitterMs, rtt, packetLossRate);
    const qualityLevel = qualityLevelFromMOS(mos);

    const metrics: CallQualityMetrics = {
      callId: this.callId,
      timestamp: new Date().toISOString(),
      qualityLevel,
      mos,
      jitter: jitterMs,
      roundTripTime: rtt,
      packetLossRate,
      inbound,
      outbound,
    };

    if (this.onMetrics) {
      this.onMetrics(metrics);
    }
  }
}
