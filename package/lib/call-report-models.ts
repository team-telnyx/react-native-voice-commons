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
  enableCallReports: true,
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

export interface StatsInterval {
  intervalStartUtc: string;
  intervalEndUtc: string;
  audio: {
    outbound: AudioOutboundStats | null;
    inbound: AudioInboundStats | null;
  };
  connection: ConnectionStats | null;
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
}
