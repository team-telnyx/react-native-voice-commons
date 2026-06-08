/**
 * Call Report data models matching the iOS SDK and voice-sdk-proxy spec.
 * POST endpoint: https://{host}/call_report
 */

export interface CallReportConfig {
  /** Enable automatic call quality reporting. Default: true */
  enableCallReports: boolean;
  /** Stats collection interval in seconds. Default: 5 */
  callReportInterval: number;
  /** Minimum log level to capture: 'debug' | 'info' | 'warn' | 'error'. Default: 'debug' */
  callReportLogLevel: string;
  /** Maximum log entries to buffer per call. Default: 1000 */
  callReportMaxLogEntries: number;
}

export const DEFAULT_CALL_REPORT_CONFIG: CallReportConfig = {
  enableCallReports: false,
  callReportInterval: 5,
  callReportLogLevel: 'debug',
  callReportMaxLogEntries: 1000,
};

export interface CallReportSummary {
  callId: string;
  destinationNumber?: string | null;
  callerNumber?: string | null;
  direction: 'OUTGOING' | 'INCOMING' | 'ATTACH';
  state: 'active' | 'done' | 'dropped';
  durationSeconds: number | null;
  telnyxSessionId?: string | null;
  telnyxLegId?: string | null;
  voiceSdkSessionId?: string | null;
  sdkVersion: string;
  startTimestamp: string;
  endTimestamp: string | null;
}

export interface AudioOutboundStats {
  packetsSent: number;
  bytesSent: number;
  audioLevelAvg: number | null;
  bitrateAvg: number | null;
  localTrack?: LocalAudioTrackSnapshot;
  mediaSource?: LocalAudioSourceStats;
}

export interface AudioInboundStats {
  packetsReceived: number;
  bytesReceived: number;
  packetsLost: number;
  packetsDiscarded: number;
  jitterBufferDelay: number | null;
  jitterBufferEmittedCount: number | null;
  totalSamplesReceived: number | null;
  concealedSamples: number | null;
  concealmentEvents: number | null;
  audioLevelAvg: number | null;
  jitterAvg: number | null;
  bitrateAvg: number | null;
}

export interface ConnectionStats {
  roundTripTimeAvg: number | null;
  packetsSent: number;
  packetsReceived: number;
  bytesSent: number;
  bytesReceived: number;
}

export interface LocalAudioTrackSnapshot {
  id?: string;
  label?: string;
  enabled?: boolean;
  muted?: boolean;
  readyState?: string;
  contentHint?: string;
  settings?: {
    deviceId?: string;
    groupId?: string;
    channelCount?: number;
    sampleRate?: number;
    sampleSize?: number;
    latency?: number;
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
    autoGainControl?: boolean;
  };
}

export interface LocalAudioSourceStats {
  id?: string;
  trackIdentifier?: string;
  audioLevel?: number;
  totalAudioEnergy?: number;
  totalSamplesDuration?: number;
  echoReturnLoss?: number;
  echoReturnLossEnhancement?: number;
}

export interface IceCandidateInfo {
  address?: string;
  port?: number;
  candidateType?: string;
  protocol?: string;
  networkType?: string;
}

export interface IceCandidatePairStats {
  id?: string;
  state?: string;
  nominated?: boolean;
  writable?: boolean;
  local?: IceCandidateInfo;
  remote?: IceCandidateInfo;
  requestsSent?: number;
  responsesReceived?: number;
}

export interface TransportStats {
  iceState?: string;
  dtlsState?: string;
  srtpCipher?: string;
  tlsVersion?: string;
  selectedCandidatePairChanges?: number;
}

export interface StatsInterval {
  intervalStartUtc: string;
  intervalEndUtc: string;
  audio: {
    outbound: AudioOutboundStats | null;
    inbound: AudioInboundStats | null;
  };
  connection: ConnectionStats | null;
  ice?: IceCandidatePairStats;
  transport?: TransportStats;
}

export interface CallReportLog {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
}

export interface CallReportPayload {
  summary: CallReportSummary;
  stats: StatsInterval[];
  logs: CallReportLog[];
  segment?: number;
  flushReason?: CallReportFlushReason;
}

export interface CallReportFlushReason {
  type: 'buffer-limit' | 'manual' | 'socket-close' | 'socket-error' | 'safety-interval';
  socketClose?: {
    code?: number;
    codeName?: string;
    reason?: string;
    wasClean?: boolean;
    error?: string;
  };
}
