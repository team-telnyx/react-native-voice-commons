/**
 * Type definitions for Telnyx React Native Voice SDK
 * This file provides type definitions without importing the actual SDK
 */

declare module '@telnyx/react-native-voice-sdk' {
  import { EventEmitter } from 'eventemitter3';

  export interface CallOptions {
    callerIdName?: string;
    callerIdNumber?: string;
    customHeaders?: { name: string; value: string }[];
    clientState?: string;
    destinationNumber?: string;
    audio?: boolean;
    video?: boolean;
    peerConnectionOptions?: {
      prefetchIceCandidates?: boolean;
      useTrickleIce?: boolean;
      iceServers?: any[];
      iceTransportPolicy?: string;
      bundlePolicy?: string;
      rtcpMuxPolicy?: string;
    };
  }

  /** A STUN/TURN server for WebRTC peer connections (core `TelnyxIceServer`). */
  export interface TelnyxIceServer {
    urls: string;
    username?: string;
    credential?: string;
  }

  export interface ClientOptions {
    environment?: 'production' | 'development';
    login?: string;
    password?: string;
    token?: string;
    login_token?: string;
    ringtoneFile?: string;
    ringbackFile?: string;
    debug?: boolean;
    logLevel?: string;
    pushNotificationDeviceToken?: string;
    pushWhenActive?: boolean;
    enableMissedCallNotifications?: boolean;
    useTrickleIce?: boolean;
    enableCallReports?: boolean;
    enableQualityMetrics?: boolean;
    callReportInterval?: number;
    callReportLogLevel?: string;
    callReportMaxLogEntries?: number;
    /** Custom ICE servers (STUN/TURN) for WebRTC peer connections */
    iceServers?: TelnyxIceServer[];
    sdkName?: string;
    sdkVersion?: string;
  }

  export enum CallState {
    NEW = 'new',
    CONNECTING = 'connecting',
    RINGING = 'ringing',
    ACTIVE = 'active',
    HELD = 'held',
    HANGUP = 'hangup',
    DESTROY = 'destroy',
    PURGE = 'purge',
  }

  /**
   * Quality rating derived from the MOS score (same bands as iOS and Android).
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
   * Snapshot of call quality metrics at a single sampling point. Field names
   * and units match iOS `CallQualityMetrics`.
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

  export class Call extends EventEmitter {
    callId: string;
    state: CallState;
    direction: 'inbound' | 'outbound';
    remoteCallerIdName?: string;
    remoteCallerIdNumber?: string;
    localCallerIdName?: string;
    localCallerIdNumber?: string;

    /**
     * Custom headers received from the WebRTC INVITE message.
     * These headers are passed during call initiation and can contain application-specific information.
     * Format: `[{"name": "X-Header-Name", "value": "Value"}]`; header names must start with `X-`.
     */
    inviteCustomHeaders: { name: string; value: string }[] | null;

    /**
     * Custom headers received from the WebRTC ANSWER message.
     * These headers are passed during call acceptance and can contain application-specific information.
     * Format: `[{"name": "X-Header-Name", "value": "Value"}]`; header names must start with `X-`.
     */
    answerCustomHeaders: { name: string; value: string }[] | null;

    /**
     * Callback invoked with each call quality metrics snapshot (every 200 ms by
     * default) while collection is active. Snapshots are also emitted as the
     * `telnyx.call.qualityMetrics` event.
     */
    onQualityMetrics: ((metrics: CallQualityMetrics) => void) | null;

    constructor(options: any);

    answer(customHeaders?: { name: string; value: string }[]): Promise<void>;
    hangup(customHeaders?: { name: string; value: string }[]): Promise<void>;
    hold(): Promise<void>;
    unhold(): Promise<void>;
    mute(): Promise<void>;
    unmute(): Promise<void>;
    dtmf(digits: string): Promise<void>;

    on(event: string, listener: (...args: any[]) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): boolean;
  }

  export class TelnyxRTC extends EventEmitter {
    constructor(options: ClientOptions);

    connect(): Promise<void>;
    disconnect(): void;
    newCall(options: CallOptions): Promise<Call>;
    disablePushNotification(): void;

    on(event: string, listener: (...args: any[]) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): boolean;
  }

  export { TelnyxRTC as default };
}
