import uuid from 'uuid-random';

/**
 * Stats event data structure matching the Android implementation
 */
export interface StatsEvent {
  event: string;
  tag: string;
  peerId: string;
  connectionId: string;
  data?: Record<string, unknown> | string;
  timestamp: string;
  statsObject?: Record<string, unknown>;
}

/**
 * WebRTC stats event types
 */
export enum WebRTCStatsEvent {
  SIGNALING_CHANGE = 'onsignalingstatechange',
  ICE_GATHER_CHANGE = 'onicegatheringstatechange',
  ON_ICE_CANDIDATE = 'onicecandidate',
  ON_ADD_TRACK = 'ontrack',
  ON_RENEGOTIATION_NEEDED = 'onnegotiationneeded',
  ON_DATA_CHANNEL = 'ondatachannel',
  ON_ICE_CONNECTION_STATE_CHANGE = 'oniceconnectionstatechange',
  ON_ICE_CANDIDATE_ERROR = 'onicecandidateerror',
  ADD_CONNECTION = 'addConnection',
  STATS = 'stats',
}

/**
 * WebRTC stats tag types
 */
export enum WebRTCStatsTag {
  PEER = 'peer',
  STATS = 'stats',
  CONNECTION = 'connection',
  TRACK = 'track',
  DATACHANNEL = 'datachannel',
  GETUSERMEDIA = 'getUserMedia',
}

/**
 * Create a debug report start message
 * Matches Android SDK format: fields at root level with `type` instead of `method`
 */
export function createDebugReportStartMessage(debugReportId: string) {
  return {
    id: uuid(),
    jsonrpc: '2.0',
    type: 'debug_report_start',
    debug_report_id: debugReportId,
    debug_report_version: 1,
  };
}

/**
 * Create a debug report stop message
 */
export function createDebugReportStopMessage(debugReportId: string) {
  return {
    id: uuid(),
    jsonrpc: '2.0',
    type: 'debug_report_stop',
    debug_report_id: debugReportId,
    debug_report_version: 1,
  };
}

/**
 * Create a debug report data message
 */
export function createDebugReportDataMessage(
  debugReportId: string,
  reportData: StatsEvent
) {
  return {
    id: uuid(),
    jsonrpc: '2.0',
    type: 'debug_report_data',
    debug_report_id: debugReportId,
    debug_report_version: 1,
    debug_report_data: reportData,
  };
}

/**
 * Create a stats event object
 */
export function createStatsEvent(params: {
  event: string;
  tag: string;
  peerId: string;
  connectionId: string;
  data?: Record<string, unknown> | string;
  statsObject?: Record<string, unknown>;
}): StatsEvent {
  return {
    event: params.event,
    tag: params.tag,
    peerId: params.peerId,
    connectionId: params.connectionId,
    data: params.data,
    timestamp: new Date().toISOString(),
    statsObject: params.statsObject,
  };
}
