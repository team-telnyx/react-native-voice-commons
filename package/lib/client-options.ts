import type { LogLevelNames } from 'loglevel';
export interface ClientOptions {
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
   * The push notification device token, used for receiving push notifications on a specific device.
   * This is typically used for mobile applications to receive incoming call notifications.
   */
  pushNotificationDeviceToken?: string;
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
}
