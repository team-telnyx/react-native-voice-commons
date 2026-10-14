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

  export interface ClientOptions {
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
    callReportInterval?: number;
    callReportLogLevel?: string;
    callReportMaxLogEntries?: number;
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
   * Quality level classification derived from the estimated MOS score.
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
   * All values come from WebRTC `getStats()` reports; missing fields are `null`.
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
     * Callback invoked periodically (default every 5 seconds) while the call
     * is active with a snapshot of call quality metrics.
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
