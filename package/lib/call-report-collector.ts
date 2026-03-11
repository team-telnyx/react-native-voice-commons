import log from 'loglevel';
import type { RTCPeerConnection as RTCPeerConnectionType } from 'react-native-webrtc';
import { SDK_VERSION } from './env';
import { LogCollector } from './log-collector';
import type {
  CallReportConfig,
  CallReportPayload,
  CallReportSummary,
  StatsInterval,
  AudioInboundStats,
  AudioOutboundStats,
  ConnectionStats,
} from './call-report-models';

const MAX_STATS_BUFFER = 360; // ~30 min at 5s intervals
const STATS_FLUSH_THRESHOLD = 300; // ~25 min
const LOGS_FLUSH_THRESHOLD = 800;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;

function round4(val: number | null | undefined): number | null {
  if (val == null || isNaN(val)) return null;
  return Math.round(val * 10000) / 10000;
}

export class CallReportCollector {
  private config: CallReportConfig;
  private peerConnection: RTCPeerConnectionType | null = null;
  private logCollector: LogCollector;
  private statsBuffer: StatsInterval[] = [];
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private intervalStart: Date | null = null;
  private segmentIndex = 0;
  private isFlushing = false;
  private started = false;

  // Previous values for delta calculations
  private prevOutboundBytes = 0;
  private prevOutboundTimestamp = 0;
  private prevInboundBytes = 0;
  private prevInboundTimestamp = 0;

  // Sample accumulators for interval averages
  private outboundAudioLevels: number[] = [];
  private inboundAudioLevels: number[] = [];
  private inboundJitters: number[] = [];
  private roundTripTimes: number[] = [];

  /** Called when intermediate flush is needed (long calls) */
  public onFlushNeeded: (() => void) | null = null;

  constructor(config: CallReportConfig) {
    this.config = config;
    this.logCollector = new LogCollector(config.callReportMaxLogEntries, config.callReportLogLevel);

    this.logCollector.add('info', 'CallReportCollector: Starting stats and log collection', {
      interval: config.callReportInterval,
      logLevel: config.callReportLogLevel,
    });
  }

  /** Log a structured event */
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>): void {
    this.logCollector.add(level, message, context);
  }

  /** Start periodic stats collection. Call after peer connection is available. */
  start(peerConnection: RTCPeerConnectionType): void {
    if (this.started) return;
    if (!peerConnection) {
      log.warn('[CallReportCollector] Cannot start: no peer connection');
      return;
    }

    this.peerConnection = peerConnection;
    this.started = true;
    this.intervalStart = new Date();

    log.debug('[CallReportCollector] Starting stats collection');

    this.statsTimer = setInterval(() => {
      this.collectInterval();
    }, this.config.callReportInterval * 1000);
  }

  /** Stop collection and return final payload */
  stop(): void {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
    this.started = false;
  }

  /** Build the final payload for POST */
  buildPayload(summary: CallReportSummary): CallReportPayload {
    const payload: CallReportPayload = {
      summary,
      stats: [...this.statsBuffer],
      logs: this.logCollector.getLogs(),
    };
    if (this.segmentIndex > 0) {
      payload.segment = this.segmentIndex;
    }
    return payload;
  }

  /** Build an intermediate flush payload (destructively drains buffers) */
  flush(summary: CallReportSummary): CallReportPayload {
    const currentSegment = this.segmentIndex;
    this.segmentIndex++;

    const stats = this.statsBuffer;
    this.statsBuffer = [];

    const logs = this.logCollector.drain();

    return {
      summary,
      stats,
      logs,
      segment: currentSegment,
    };
  }

  /** POST the payload to voice-sdk-proxy */
  async sendPayload(
    payload: CallReportPayload,
    callReportId: string,
    host: string,
    voiceSdkId?: string | null
  ): Promise<void> {
    const endpoint = this.buildEndpoint(host);
    if (!endpoint) {
      log.error('[CallReportCollector] Failed to construct endpoint URL from host:', host);
      return;
    }

    if (!callReportId) {
      log.warn('[CallReportCollector] Cannot post call report: missing call_report_id');
      return;
    }

    let body: string;
    try {
      body = JSON.stringify(payload);
    } catch (err) {
      log.error('[CallReportCollector] Failed to encode payload:', err);
      return;
    }

    log.debug(
      `[CallReportCollector] Sending payload (endpoint: ${endpoint}, intervals: ${payload.stats.length}, logs: ${payload.logs.length}, segment: ${payload.segment ?? 'final'}, callId: ${payload.summary.callId})`
    );

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-call-report-id': callReportId,
      'x-call-id': payload.summary.callId,
    };
    if (voiceSdkId) {
      headers['x-voice-sdk-id'] = voiceSdkId;
    }

    await this.executeUpload(endpoint, headers, body, 1);
  }

  // --- Private ---

  private async collectInterval(): Promise<void> {
    if (!this.peerConnection) return;

    const intervalEnd = new Date();
    const intervalStart = this.intervalStart || intervalEnd;
    this.intervalStart = intervalEnd;

    try {
      const stats = await (this.peerConnection as any).getStats();
      const interval = this.processStats(stats, intervalStart, intervalEnd);

      if (this.statsBuffer.length >= MAX_STATS_BUFFER) {
        this.statsBuffer.shift();
      }
      this.statsBuffer.push(interval);

      this.checkFlushThresholds();
    } catch (err) {
      log.error('[CallReportCollector] Error collecting stats:', err);
    }
  }

  private processStats(stats: any, intervalStart: Date, intervalEnd: Date): StatsInterval {
    let outbound: AudioOutboundStats | null = null;
    let inbound: AudioInboundStats | null = null;
    let connection: ConnectionStats | null = null;

    // Accumulate samples during this interval
    const outAudioLevels = this.outboundAudioLevels;
    const inAudioLevels = this.inboundAudioLevels;
    const inJitters = this.inboundJitters;
    const rtts = this.roundTripTimes;

    stats.forEach((report: any) => {
      switch (report.type) {
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

            outbound = {
              packetsSent: report.packetsSent ?? 0,
              bytesSent: bytes,
              audioLevelAvg: round4(avg(outAudioLevels)),
              bitrateAvg: round4(bitrateAvg),
            };
          }
          break;

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

            if (report.jitter != null) inJitters.push(report.jitter * 1000); // sec → ms
            if (report.audioLevel != null) inAudioLevels.push(report.audioLevel);

            inbound = {
              packetsReceived: report.packetsReceived ?? 0,
              bytesReceived: bytes,
              packetsLost: report.packetsLost ?? 0,
              packetsDiscarded: report.packetsDiscarded ?? 0,
              jitterBufferDelay: report.jitterBufferDelay ?? null,
              jitterBufferEmittedCount: report.jitterBufferEmittedCount ?? null,
              totalSamplesReceived: report.totalSamplesReceived ?? null,
              concealedSamples: report.concealedSamples ?? null,
              concealmentEvents: report.concealmentEvents ?? null,
              audioLevelAvg: round4(avg(inAudioLevels)),
              jitterAvg: round4(avg(inJitters)),
              bitrateAvg: round4(bitrateAvg),
            };
          }
          break;

        case 'candidate-pair':
          if (report.nominated || report.state === 'succeeded') {
            if (report.currentRoundTripTime != null) {
              rtts.push(report.currentRoundTripTime);
            }
            connection = {
              roundTripTimeAvg: round4(avg(rtts)),
              packetsSent: report.packetsSent ?? 0,
              packetsReceived: report.packetsReceived ?? 0,
              bytesSent: report.bytesSent ?? 0,
              bytesReceived: report.bytesReceived ?? 0,
            };
          }
          break;

        case 'media-source':
          if (report.kind === 'audio' && report.audioLevel != null) {
            outAudioLevels.push(report.audioLevel);
          }
          break;
      }
    });

    // Clear accumulators for next interval
    this.outboundAudioLevels = [];
    this.inboundAudioLevels = [];
    this.inboundJitters = [];
    this.roundTripTimes = [];

    return {
      intervalStartUtc: intervalStart.toISOString(),
      intervalEndUtc: intervalEnd.toISOString(),
      audio: { outbound, inbound },
      connection,
    };
  }

  private checkFlushThresholds(): void {
    if (this.isFlushing) return;
    if (
      this.statsBuffer.length >= STATS_FLUSH_THRESHOLD ||
      this.logCollector.count >= LOGS_FLUSH_THRESHOLD
    ) {
      log.debug(
        `[CallReportCollector] Flush threshold reached (stats: ${this.statsBuffer.length}/${STATS_FLUSH_THRESHOLD}, logs: ${this.logCollector.count}/${LOGS_FLUSH_THRESHOLD})`
      );
      this.isFlushing = true;
      try {
        this.onFlushNeeded?.();
      } finally {
        this.isFlushing = false;
      }
    }
  }

  private buildEndpoint(host: string): string | null {
    try {
      // Convert ws(s) URL to http(s)
      let httpHost = host
        .replace(/^wss:\/\//, 'https://')
        .replace(/^ws:\/\//, 'http://');

      // If no protocol, default to https
      if (!httpHost.startsWith('http')) {
        httpHost = `https://${httpHost}`;
      }

      const url = new URL(httpHost);
      url.pathname = '/call_report';
      // Remove any query params from the WS URL
      url.search = '';
      return url.toString();
    } catch (err) {
      log.error('[CallReportCollector] Invalid host URL:', host, err);
      return null;
    }
  }

  private async executeUpload(
    endpoint: string,
    headers: Record<string, string>,
    body: string,
    attempt: number
  ): Promise<void> {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body,
      });

      if (response.ok) {
        log.debug(`[CallReportCollector] Successfully posted report (status: ${response.status})`);
        return;
      }

      const status = response.status;
      const responseBody = await response.text().catch(() => '');

      if (status >= 400 && status < 500) {
        log.error(
          `[CallReportCollector] Failed to post report (attempt ${attempt}, status: ${status}, error: ${responseBody})`
        );
        // Don't retry client errors
        return;
      }

      // 5xx — retry
      log.warn(
        `[CallReportCollector] Server error posting report (attempt ${attempt}, status: ${status})`
      );
      await this.retryIfNeeded(endpoint, headers, body, attempt);
    } catch (err) {
      log.error(`[CallReportCollector] Error posting report (attempt ${attempt}):`, err);
      await this.retryIfNeeded(endpoint, headers, body, attempt);
    }
  }

  private async retryIfNeeded(
    endpoint: string,
    headers: Record<string, string>,
    body: string,
    attempt: number
  ): Promise<void> {
    if (attempt >= MAX_RETRY_ATTEMPTS) {
      log.error(`[CallReportCollector] All ${MAX_RETRY_ATTEMPTS} upload attempts failed`);
      return;
    }

    const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
    log.debug(`[CallReportCollector] Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS})`);

    await new Promise((resolve) => setTimeout(resolve, delay));
    await this.executeUpload(endpoint, headers, body, attempt + 1);
  }
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
