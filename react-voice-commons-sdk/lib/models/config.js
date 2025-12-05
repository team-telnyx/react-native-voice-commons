'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.isCredentialConfig = isCredentialConfig;
exports.isTokenConfig = isTokenConfig;
exports.validateCredentialConfig = validateCredentialConfig;
exports.validateTokenConfig = validateTokenConfig;
exports.validateConfig = validateConfig;
exports.createCredentialConfig = createCredentialConfig;
exports.createTokenConfig = createTokenConfig;
/**
 * Type guard to check if config is credential-based
 */
function isCredentialConfig(config) {
  return config.type === 'credential';
}
/**
 * Type guard to check if config is token-based
 */
function isTokenConfig(config) {
  return config.type === 'token';
}
/**
 * Validates a credential configuration
 */
function validateCredentialConfig(config) {
  const errors = [];
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
function validateTokenConfig(config) {
  const errors = [];
  if (!config.token || config.token.trim() === '') {
    errors.push('token is required');
  }
  return errors;
}
/**
 * Validates any configuration
 */
function validateConfig(config) {
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
function createCredentialConfig(sipUser, sipPassword, options) {
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
function createTokenConfig(sipToken, options) {
  return {
    type: 'token',
    token: sipToken,
    ...options,
  };
}
