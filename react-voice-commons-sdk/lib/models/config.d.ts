/**
 * Configuration for credential-based authentication
 */
export interface CredentialConfig {
  type: 'credential';
  sipUser: string;
  sipPassword: string;
  debug?: boolean;
  pushNotificationDeviceToken?: string;
}
/**
 * Configuration for token-based authentication
 */
export interface TokenConfig {
  type: 'token';
  token: string;
  debug?: boolean;
  pushNotificationDeviceToken?: string;
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
 * @returns Complete token configuration object
 */
export declare function createTokenConfig(
  sipToken: string,
  options?: Partial<Omit<TokenConfig, 'type' | 'sipToken'>>
): TokenConfig;
