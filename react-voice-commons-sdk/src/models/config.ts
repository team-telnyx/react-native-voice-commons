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
export function isCredentialConfig(config: Config): config is CredentialConfig {
  return config.type === 'credential';
}

/**
 * Type guard to check if config is token-based
 */
export function isTokenConfig(config: Config): config is TokenConfig {
  return config.type === 'token';
}

/**
 * Validates a credential configuration
 */
export function validateCredentialConfig(config: CredentialConfig): string[] {
  const errors: string[] = [];

  if (!config.sipUser || config.sipUser.trim() === '') {
    errors.push('sipUser is required');
  }

  if (!config.sipPassword || config.sipPassword.trim() === '') {
    errors.push('sipPassword is required');
  }

  return errors;
}

/**
 * Validates a token configuration
 */
export function validateTokenConfig(config: TokenConfig): string[] {
  const errors: string[] = [];

  if (!config.token || config.token.trim() === '') {
    errors.push('token is required');
  }

  return errors;
}

/**
 * Validates any configuration
 */
export function validateConfig(config: Config): string[] {
  if (isCredentialConfig(config)) {
    return validateCredentialConfig(config);
  } else if (isTokenConfig(config)) {
    return validateTokenConfig(config);
  } else {
    return ['Invalid configuration type'];
  }
}

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
export function createCredentialConfig(
  sipUser: string,
  sipPassword: string,
  options?: Partial<Omit<CredentialConfig, 'type' | 'sipUser' | 'sipPassword'>>
): CredentialConfig {
  return {
    type: 'credential',
    sipUser,
    sipPassword,
    ...options,
  };
}

/**
 * Creates a token-based configuration
 *
 * @param sipToken - JWT token for authentication
 * @param options - Optional configuration settings
 * @param options.debug - Enable debug logging (sets SDK logLevel to 'debug')
 * @param options.pushNotificationDeviceToken - Device token for push notifications
 * @returns Complete token configuration object
 */
export function createTokenConfig(
  sipToken: string,
  options?: Partial<Omit<TokenConfig, 'type' | 'sipToken'>>
): TokenConfig {
  return {
    type: 'token',
    token: sipToken,
    ...options,
  };
}
