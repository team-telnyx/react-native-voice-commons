import type { LogLevelNames } from 'loglevel';
import type { TelnyxEnvironment } from './env';
export interface ClientOptions {
  /**
   * Signaling environment used by the WebSocket connection.
   * @default 'production'
   */
  environment?: TelnyxEnvironment;
  /**
   * The `username` to authenticate with your SIP Connection.
   * `login` and `password` will take precedence over
   * `login_token` for authentication.
   */
  login?: string;
  /**
   * The `password` to authenticate with your SIP Connection.
   */
  password?: string;
  /**
   * The JSON Web Token (JWT) to authenticate with your SIP Connection.
   * This is the recommended authentication strategy. [See how to create one](https://developers.telnyx.com/docs/voice/webrtc/auth/jwt).
   */
  login_token?: string;
  /**
   * Force the use of a relay ICE candidate.
   */
  forceRelayCandidate?: boolean;
  /**
   * Enable or disable prefetching ICE candidates.
   */
  prefetchIceCandidates?: boolean;
  /**
   * Enable Trickle ICE by default for inbound calls created by this client.
   * Outbound calls can override this per call with peerConnectionOptions.useTrickleIce.
   * @default false
   */
  useTrickleIce?: boolean;
  /**
   * The push notification device token, used for receiving push notifications on a specific device.
   * This is typically used for mobile applications to receive incoming call notifications.
   */
  pushNotificationDeviceToken?: string;
  /**
   * Keep this PushKit device eligible for incoming call delivery while its
   * WebSocket session is already active.
   *
   * When enabled, login advertises `push_when_active` and `pn_late_fanout`,
   * and answers identify the PushKit device that accepted the call.
   * @default false
   */
  pushWhenActive?: boolean;
  /**
   * Enable native missed call push notifications.
   * When enabled, the SDK tags the User-Agent with the missed-call notification marker.
   * @default false
   */
  enableMissedCallNotifications?: boolean;
  /**
   * Set the log level for the TelnyxRTC client.s
   * It can be one of the following values: 'trace', 'debug', 'info', 'warn', 'error', 'silent'.
   */
  logLevel?: LogLevelNames;
  /**
   * Enable or disable debug mode for WebRTC stats collection.
   * When enabled, the SDK will collect and send WebRTC statistics to the Telnyx debug service.
   * This is useful for debugging call quality issues.
   * @default false
   */
  debug?: boolean;
  /**
   * Deliver real-time call quality metrics (MOS, jitter, RTT, audio levels)
   * through `Call.onQualityMetrics` and the `telnyx.call.qualityMetrics` event
   * while a call is active. Also enabled by `debug`. Default: false.
   */
  enableQualityMetrics?: boolean;

  /**
   * Enable automatic call quality reporting to voice-sdk-proxy.
   * When enabled, the SDK collects WebRTC stats and structured logs during calls
   * and POSTs them to the /call_report endpoint when calls end.
   * @default true
   */
  enableCallReports?: boolean;
  /**
   * Interval in seconds for collecting call report statistics.
   * @default 5
   */
  callReportInterval?: number;
  /**
   * Minimum log level to capture for call reports: 'debug' | 'info' | 'warn' | 'error'.
   * @default 'debug'
   */
  callReportLogLevel?: string;
  /**
   * Maximum number of log entries to buffer per call.
   * @default 1000
   */
  callReportMaxLogEntries?: number;
  /**
   * Override the public SDK identity atomically. Wrapper SDKs must provide
   * both sdkName and sdkVersion; partial overrides are rejected.
   */
  sdkName?: string;
  sdkVersion?: string;
}
