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
  IceCandidateInfo,
  IceCandidatePairStats,
  LocalAudioSourceStats,
  LocalAudioTrackSnapshot,
  TransportStats,
  CallReportFlushReason,
} from './call-report-models';

const MAX_STATS_BUFFER = 360; // ~30 min at 5s intervals
const STATS_FLUSH_THRESHOLD = 300; // ~25 min
const LOGS_FLUSH_THRESHOLD = 800;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;
const INITIAL_COLLECTION_INTERVAL_SECONDS = 1;
const INITIAL_COLLECTION_DURATION_MS = 10_000;
const DEFAULT_INTERMEDIATE_REPORT_INTERVAL_MS = 180_000;

function round4(val: number | null | undefined): number | null {
  if (val == null || isNaN(val)) return null;
  return Math.round(val * 10000) / 10000;
}

export class CallReportCollector {
  private config: CallReportConfig;
  private peerConnection: RTCPeerConnectionType | null = null;
  private logCollector: LogCollector;
  private statsBuffer: StatsInterval[] = [];
  private latestStatsInterval: StatsInterval | null = null;
  private statsTimer: ReturnType<typeof setTimeout> | null = null;
  private intervalStart: Date | null = null;
  private callStartTime: Date = new Date();
  private callEndTime: Date | null = null;
  private segmentIndex = 0;
  private isFlushing = false;
  private started = false;
  private stopped = false;
  private lastIntermediateFlushTime: Date = this.callStartTime;
  private lastLocalAudioTrackSnapshotJson: string | null = null;

  // Previous values for delta calculations
  private prevOutboundBytes = 0;
  private prevOutboundTimestamp = 0;
  private prevInboundBytes = 0;
  private prevInboundTimestamp = 0;
  private prevInboundAudioEnergy: number | undefined;
  private prevInboundSamplesDuration: number | undefined;
  private prevOutboundAudioEnergy: number | undefined;
  private prevOutboundSamplesDuration: number | undefined;

  // Sample accumulators for interval averages
  private outboundAudioLevels: number[] = [];
  private inboundAudioLevels: number[] = [];
  private inboundJitters: number[] = [];
  private roundTripTimes: number[] = [];

  /** Called when intermediate flush is needed (long calls) */
  public onFlushNeeded: (() => void) | null = null;

  /** Most recent stats interval collected for UI/debug surfaces. */
  get latestInterval(): StatsInterval | null {
    return this.latestStatsInterval;
  }

  constructor(config: CallReportConfig) {
    this.config = config;
    this.logCollector = new LogCollector(config.callReportMaxLogEntries, config.callReportLogLevel);

    this.logCollector.add('info', 'CallReportCollector: Starting stats and log collection', {
      interval: config.callReportInterval,
      logLevel: config.callReportLogLevel,
    });
  }

  /** Log a structured event */
  log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: Record<string, unknown>
  ): void {
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
    this.stopped = false;
    this.callStartTime = new Date();
    this.intervalStart = new Date();
    this.lastIntermediateFlushTime = this.intervalStart;

    log.debug('[CallReportCollector] Starting stats collection');

    this.scheduleNextCollection();
  }

  /** Stop collection and return final payload */
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.statsTimer) {
      clearTimeout(this.statsTimer);
      this.statsTimer = null;
    }

    this.callEndTime = new Date();
    if (this.peerConnection && this.intervalStart) {
      await this.collectInterval(true);
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

  /**
   * Build an intermediate flush payload and destructively drain buffers.
   * Intermediate summaries are bounded to the flushed segment window.
   */
  flush(summary: CallReportSummary, flushReason?: CallReportFlushReason): CallReportPayload {
    const currentSegment = this.segmentIndex;
    this.segmentIndex++;

    const stats = this.statsBuffer;
    this.statsBuffer = [];

    const logs = this.logCollector.drain();

    const now = new Date();
    this.lastIntermediateFlushTime = now;

    return {
      summary: {
        ...summary,
        durationSeconds: (now.getTime() - this.callStartTime.getTime()) / 1000,
        startTimestamp: this.callStartTime.toISOString(),
        endTimestamp: now.toISOString(),
      },
      stats,
      logs,
      segment: currentSegment,
      ...(flushReason ? { flushReason } : {}),
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

  private scheduleNextCollection(): void {
    if (this.stopped || !this.peerConnection || !this.intervalStart || this.statsTimer) {
      return;
    }

    const intervalSeconds = this.collectionIntervalFor(this.intervalStart);
    this.statsTimer = setTimeout(() => {
      this.statsTimer = null;
      this.collectInterval().finally(() => {
        this.scheduleNextCollection();
      });
    }, intervalSeconds * 1000);
  }

  private collectionIntervalFor(intervalStart: Date): number {
    const defaultInterval =
      typeof this.config.callReportInterval === 'number' && this.config.callReportInterval > 0
        ? this.config.callReportInterval
        : 5;

    if (intervalStart.getTime() - this.callStartTime.getTime() < INITIAL_COLLECTION_DURATION_MS) {
      return Math.min(INITIAL_COLLECTION_INTERVAL_SECONDS, defaultInterval);
    }

    return defaultInterval;
  }

  private async collectInterval(isFinal: boolean = false): Promise<void> {
    if (!this.peerConnection) return;

    const intervalEnd = new Date();
    const intervalStart = this.intervalStart || intervalEnd;
    this.intervalStart = intervalEnd;

    try {
      const stats = await (this.peerConnection as any).getStats();
      const interval = this.processStats(stats, intervalStart, intervalEnd);

      const elapsedMs = intervalEnd.getTime() - intervalStart.getTime();
      if (!isFinal && elapsedMs < this.collectionIntervalFor(intervalStart) * 1000) {
        return;
      }

      if (this.statsBuffer.length >= MAX_STATS_BUFFER) {
        this.statsBuffer.shift();
      }
      this.statsBuffer.push(interval);
      this.latestStatsInterval = interval;

      this.checkFlushThresholds();
    } catch (err) {
      log.error('[CallReportCollector] Error collecting stats:', err);
    }
  }

  private processStats(stats: any, intervalStart: Date, intervalEnd: Date): StatsInterval {
    let outbound: AudioOutboundStats | null = null;
    let inbound: AudioInboundStats | null = null;
    let connection: ConnectionStats | null = null;
    let ice: IceCandidatePairStats | undefined;
    let transport: TransportStats | undefined;
    let selectedCandidatePair: any = null;
    let outboundReport: any = null;

    // Accumulate samples during this interval
    const outAudioLevels = this.outboundAudioLevels;
    const inAudioLevels = this.inboundAudioLevels;
    const inJitters = this.inboundJitters;
    const rtts = this.roundTripTimes;

    stats.forEach((report: any) => {
      switch (report.type) {
        case 'outbound-rtp':
          if (report.kind === 'audio') {
            outboundReport = report;
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

            const outboundAudioLevel = this.getOutboundAudioLevel(stats, report);
            if (outboundAudioLevel != null) {
              outAudioLevels.push(outboundAudioLevel);
            }

            const localTrack = this.getLocalAudioTrackSnapshot();
            const mediaSource = this.getOutboundAudioSourceStats(stats, report);
            this.logLocalAudioTrackSnapshot(localTrack, mediaSource);

            outbound = {
              packetsSent: report.packetsSent ?? 0,
              bytesSent: bytes,
              audioLevelAvg: round4(avg(outAudioLevels)),
              bitrateAvg: round4(bitrateAvg),
              ...(localTrack ? { localTrack } : {}),
              ...(mediaSource ? { mediaSource } : {}),
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
            const inboundAudioLevel = this.getInboundAudioLevel(stats, report);
            if (inboundAudioLevel != null) inAudioLevels.push(inboundAudioLevel);

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
            selectedCandidatePair = report;
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

        case 'transport':
          transport = this.buildTransportStats(report);
          break;

        case 'media-source':
          if (!outboundReport && report.kind === 'audio' && report.audioLevel != null) {
            outAudioLevels.push(report.audioLevel);
          }
          break;
      }
    });

    if (selectedCandidatePair) {
      ice = {
        id: selectedCandidatePair.id,
        state: selectedCandidatePair.state,
        nominated: selectedCandidatePair.nominated,
        writable: selectedCandidatePair.writable,
        requestsSent: selectedCandidatePair.requestsSent,
        responsesReceived: selectedCandidatePair.responsesReceived,
        ...(this.resolveCandidate(stats, selectedCandidatePair.localCandidateId)
          ? { local: this.resolveCandidate(stats, selectedCandidatePair.localCandidateId) }
          : {}),
        ...(this.resolveCandidate(stats, selectedCandidatePair.remoteCandidateId)
          ? { remote: this.resolveCandidate(stats, selectedCandidatePair.remoteCandidateId) }
          : {}),
      };
    }

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
      ...(ice ? { ice } : {}),
      ...(transport ? { transport } : {}),
    };
  }

  private checkFlushThresholds(): void {
    if (this.isFlushing) return;
    const now = new Date();
    const msSinceLastFlush = now.getTime() - this.lastIntermediateFlushTime.getTime();
    if (
      this.statsBuffer.length >= STATS_FLUSH_THRESHOLD ||
      this.logCollector.count >= LOGS_FLUSH_THRESHOLD ||
      msSinceLastFlush >= DEFAULT_INTERMEDIATE_REPORT_INTERVAL_MS
    ) {
      log.debug(
        `[CallReportCollector] Flush threshold reached (stats: ${this.statsBuffer.length}/${STATS_FLUSH_THRESHOLD}, logs: ${this.logCollector.count}/${LOGS_FLUSH_THRESHOLD}, msSinceLastFlush: ${msSinceLastFlush})`
      );
      this.lastIntermediateFlushTime = now;
      this.isFlushing = true;
      try {
        this.onFlushNeeded?.();
      } finally {
        this.isFlushing = false;
      }
    }
  }

  private resolveCandidate(stats: any, candidateId?: string): IceCandidateInfo | undefined {
    if (!candidateId) return undefined;
    const report = typeof stats.get === 'function' ? stats.get(candidateId) : undefined;
    if (!report) return undefined;

    const info = this.withoutUndefined({
      address: report.address ?? report.ip,
      port: report.port,
      candidateType: report.candidateType,
      protocol: report.protocol,
      networkType: report.networkType,
    });

    return Object.keys(info).length > 0 ? info : undefined;
  }

  private buildTransportStats(report: any): TransportStats | undefined {
    const transport = this.withoutUndefined({
      iceState: report.iceState,
      dtlsState: report.dtlsState,
      srtpCipher: report.srtpCipher,
      tlsVersion: report.tlsVersion,
      selectedCandidatePairChanges: report.selectedCandidatePairChanges,
    });

    return Object.keys(transport).length > 0 ? transport : undefined;
  }

  private getOutboundMediaSource(stats: any, outboundAudio: any): any | undefined {
    if (outboundAudio.mediaSourceId && typeof stats.get === 'function') {
      const mediaSource = stats.get(outboundAudio.mediaSourceId);
      if (mediaSource) return mediaSource;
    }

    let mediaSource: any | undefined;
    stats.forEach((report: any) => {
      if (!mediaSource && report.type === 'media-source' && report.kind === 'audio') {
        mediaSource = report;
      }
    });
    return mediaSource;
  }

  private getOutboundAudioSourceStats(
    stats: any,
    outboundAudio: any
  ): LocalAudioSourceStats | undefined {
    const mediaSource = this.getOutboundMediaSource(stats, outboundAudio);
    if (!mediaSource) return undefined;

    const snapshot = this.withoutUndefined({
      id: mediaSource.id,
      trackIdentifier: mediaSource.trackIdentifier,
      audioLevel: mediaSource.audioLevel,
      totalAudioEnergy: mediaSource.totalAudioEnergy,
      totalSamplesDuration: mediaSource.totalSamplesDuration,
      echoReturnLoss: mediaSource.echoReturnLoss,
      echoReturnLossEnhancement: mediaSource.echoReturnLossEnhancement,
    });

    return Object.keys(snapshot).length > 0 ? snapshot : undefined;
  }

  private getLocalAudioTrackSnapshot(): LocalAudioTrackSnapshot | undefined {
    try {
      const sender = (this.peerConnection as any)
        ?.getSenders?.()
        ?.find((item: any) => item.track?.kind === 'audio');
      const track = sender?.track;
      if (!track) return undefined;

      const settings = track.getSettings?.();
      const settingsSnapshot = this.withoutUndefined({
        deviceId: settings?.deviceId,
        groupId: settings?.groupId,
        channelCount: settings?.channelCount,
        sampleRate: settings?.sampleRate,
        sampleSize: settings?.sampleSize,
        latency: settings?.latency,
        echoCancellation: settings?.echoCancellation,
        noiseSuppression: settings?.noiseSuppression,
        autoGainControl: settings?.autoGainControl,
      });

      const snapshot = this.withoutUndefined({
        id: track.id,
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        contentHint: track.contentHint,
        ...(Object.keys(settingsSnapshot).length > 0 ? { settings: settingsSnapshot } : {}),
      });

      return Object.keys(snapshot).length > 0 ? snapshot : undefined;
    } catch (error) {
      log.debug('[CallReportCollector] Unable to snapshot local audio track:', error);
      return undefined;
    }
  }

  private getOutboundAudioLevel(stats: any, outboundAudio: any): number | null {
    const mediaSource = this.getOutboundMediaSource(stats, outboundAudio);
    if (mediaSource?.audioLevel != null) {
      return mediaSource.audioLevel;
    }

    if (mediaSource) {
      const level = this.computeAudioLevelFromEnergy(
        mediaSource.totalAudioEnergy,
        mediaSource.totalSamplesDuration,
        'outbound'
      );
      if (level != null) return level;
    }

    return this.getTrackAudioLevel(stats, outboundAudio.trackId);
  }

  private getInboundAudioLevel(stats: any, inboundAudio: any): number | null {
    if (inboundAudio.audioLevel != null) {
      return inboundAudio.audioLevel;
    }

    const level = this.computeAudioLevelFromEnergy(
      inboundAudio.totalAudioEnergy,
      inboundAudio.totalSamplesDuration,
      'inbound'
    );
    if (level != null) return level;

    return this.getTrackAudioLevel(stats, inboundAudio.trackId);
  }

  private computeAudioLevelFromEnergy(
    currentEnergy: number | undefined,
    currentDuration: number | undefined,
    direction: 'inbound' | 'outbound'
  ): number | null {
    if (currentEnergy == null || currentDuration == null) return null;

    const prevEnergy =
      direction === 'inbound' ? this.prevInboundAudioEnergy : this.prevOutboundAudioEnergy;
    const prevDuration =
      direction === 'inbound' ? this.prevInboundSamplesDuration : this.prevOutboundSamplesDuration;

    if (direction === 'inbound') {
      this.prevInboundAudioEnergy = currentEnergy;
      this.prevInboundSamplesDuration = currentDuration;
    } else {
      this.prevOutboundAudioEnergy = currentEnergy;
      this.prevOutboundSamplesDuration = currentDuration;
    }

    if (prevEnergy == null || prevDuration == null) return null;

    const deltaEnergy = currentEnergy - prevEnergy;
    const deltaDuration = currentDuration - prevDuration;
    if (deltaDuration <= 0) return null;

    return Math.min(1, Math.max(0, Math.sqrt(deltaEnergy / deltaDuration)));
  }

  private getTrackAudioLevel(stats: any, trackId?: string): number | null {
    if (!trackId || typeof stats.get !== 'function') return null;
    return stats.get(trackId)?.audioLevel ?? null;
  }

  private logLocalAudioTrackSnapshot(
    localAudioTrack?: LocalAudioTrackSnapshot,
    localAudioSource?: LocalAudioSourceStats
  ): void {
    if (!localAudioTrack || Object.keys(localAudioTrack).length === 0) return;
    const snapshotJson = JSON.stringify(this.sortObjectKeys(localAudioTrack));
    if (snapshotJson === this.lastLocalAudioTrackSnapshotJson) return;

    this.lastLocalAudioTrackSnapshotJson = snapshotJson;
    log.debug('[CallReportCollector] Local audio track snapshot', {
      localTrack: localAudioTrack,
      mediaSource: localAudioSource,
    });
  }

  private withoutUndefined<T extends Record<string, unknown>>(obj: T): T {
    return Object.keys(obj).reduce<Record<string, unknown>>((clean, key) => {
      const value = obj[key];
      if (value !== undefined) {
        clean[key] = value;
      }
      return clean;
    }, {}) as T;
  }

  private sortObjectKeys(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortObjectKeys(item));
    }

    if (value && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((sorted, key) => {
          sorted[key] = this.sortObjectKeys((value as Record<string, unknown>)[key]);
          return sorted;
        }, {});
    }

    return value;
  }

  private buildEndpoint(host: string): string | null {
    try {
      // Convert ws(s) URL to http(s)
      let httpHost = host.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');

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
    log.debug(
      `[CallReportCollector] Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS})`
    );

    await new Promise((resolve) => setTimeout(resolve, delay));
    await this.executeUpload(endpoint, headers, body, attempt + 1);
  }
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
