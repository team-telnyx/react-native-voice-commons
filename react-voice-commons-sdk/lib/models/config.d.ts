import type { TelnyxIceServer } from '@telnyx/react-native-voice-sdk';
/**
 * Configuration for credential-based authentication
 */
export type TelnyxEnvironment = 'production' | 'development';
export interface CredentialConfig {
  type: 'credential';
  sipUser: string;
  sipPassword: string;
  debug?: boolean;
  pushNotificationDeviceToken?: string;
  /** Receive PushKit calls while the WebSocket session is active. Default: false */
  pushWhenActive?: boolean;
  /** Enable native missed call push notifications. Default: false */
  enableMissedCallNotifications?: boolean;
  /** Android only: name of a bundled `res/raw` ringtone (without its file extension). Falls back to the device ringtone. */
  incomingCallRingtone?: string;
  /** Enable Trickle ICE. Default: false */
  useTrickleIce?: boolean;
  /** Signaling environment. Default: production */
  environment?: TelnyxEnvironment;
  /** Enable automatic call quality reporting. Default: true */
  enableCallReports?: boolean;
  /**
   * Deliver real-time call quality metrics on `Call.qualityMetrics$` while a
   * call is active. Also enabled by `debug`. Default: false
   */
  enableQualityMetrics?: boolean;
  /** Stats collection interval in seconds. Default: 5 */
  callReportInterval?: number;
  /** Minimum log level for call reports: 'debug' | 'info' | 'warn' | 'error'. Default: 'debug' */
  callReportLogLevel?: string;
  /** Max log entries per call. Default: 1000 */
  callReportMaxLogEntries?: number;
  /**
   * Custom ICE servers (STUN/TURN) for WebRTC peer connections.
   * When provided, overrides the Telnyx production defaults.
   * When omitted, the SDK uses Telnyx defaults (STUN → TURN UDP → TURN TCP → TURNS 443).
   */
  iceServers?: TelnyxIceServer[];
}
/**
 * Configuration for token-based authentication
 */
export interface TokenConfig {
  type: 'token';
  token: string;
  debug?: boolean;
  pushNotificationDeviceToken?: string;
  /** Receive PushKit calls while the WebSocket session is active. Default: false */
  pushWhenActive?: boolean;
  /** Enable native missed call push notifications. Default: false */
  enableMissedCallNotifications?: boolean;
  /** Android only: name of a bundled `res/raw` ringtone (without its file extension). Falls back to the device ringtone. */
  incomingCallRingtone?: string;
  /** Enable Trickle ICE. Default: false */
  useTrickleIce?: boolean;
  /** Signaling environment. Default: production */
  environment?: TelnyxEnvironment;
  /** Enable automatic call quality reporting. Default: true */
  enableCallReports?: boolean;
  /**
   * Deliver real-time call quality metrics on `Call.qualityMetrics$` while a
   * call is active. Also enabled by `debug`. Default: false
   */
  enableQualityMetrics?: boolean;
  /** Stats collection interval in seconds. Default: 5 */
  callReportInterval?: number;
  /** Minimum log level for call reports: 'debug' | 'info' | 'warn' | 'error'. Default: 'debug' */
  callReportLogLevel?: string;
  /** Max log entries per call. Default: 1000 */
  callReportMaxLogEntries?: number;
  /**
   * Custom ICE servers (STUN/TURN) for WebRTC peer connections.
   * When provided, overrides the Telnyx production defaults.
   * When omitted, the SDK uses Telnyx defaults (STUN → TURN UDP → TURN TCP → TURNS 443).
   */
  iceServers?: TelnyxIceServer[];
}
/**
 * Union type for all supported authentication configurations
 */
export type Config = CredentialConfig | TokenConfig;
/**
 * Type guard to check if config is credential-based
 */
export declare function isCredentialConfig(config: Config): config is CredentialConfig;
/**
 * Type guard to check if config is token-based
 */
export declare function isTokenConfig(config: Config): config is TokenConfig;
/**
 * Validates a credential configuration
 */
export declare function validateCredentialConfig(config: CredentialConfig): string[];
/**
 * Validates a token configuration
 */
export declare function validateTokenConfig(config: TokenConfig): string[];
/**
 * Validates any configuration
 */
export declare function validateConfig(config: Config): string[];
/**
 * Creates a credential configuration
 *
 * @param sipUser - SIP username for authentication
 * @param sipPassword - SIP password for authentication
 * @param options - Optional configuration settings
 * @param options.debug - Enable debug logging (sets SDK logLevel to 'debug')
 * @param options.pushNotificationDeviceToken - Device token for push notifications
 * @param options.pushWhenActive - Keep active PushKit devices eligible for incoming calls
 * @returns Complete credential configuration object
 */
export declare function createCredentialConfig(
  sipUser: string,
  sipPassword: string,
  options?: Partial<Omit<CredentialConfig, 'type' | 'sipUser' | 'sipPassword'>>
): CredentialConfig;
/**
 * Creates a token-based configuration
 *
 * @param sipToken - JWT token for authentication
 * @param options - Optional configuration settings
 * @param options.debug - Enable debug logging (sets SDK logLevel to 'debug')
 * @param options.pushNotificationDeviceToken - Device token for push notifications
 * @param options.pushWhenActive - Keep active PushKit devices eligible for incoming calls
 * @returns Complete token configuration object
 */
export declare function createTokenConfig(
  sipToken: string,
  options?: Partial<Omit<TokenConfig, 'type' | 'sipToken'>>
): TokenConfig;
