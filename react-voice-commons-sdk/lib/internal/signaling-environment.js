'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.SIGNALING_ENVIRONMENT_STORAGE_KEY = void 0;
exports.resolveStoredEnvironment = resolveStoredEnvironment;
exports.SIGNALING_ENVIRONMENT_STORAGE_KEY = '@telnyx_signaling_environment';
/**
 * Resolves the signaling environment for a stored-config restore.
 *
 * An explicit stored selection always wins. A missing or invalid stored value
 * (e.g. credentials persisted by an older Commons version) falls back to the
 * client's configured default, and only then to production.
 */
function resolveStoredEnvironment(storedEnvironment, defaultEnvironment) {
  if (storedEnvironment === 'development' || storedEnvironment === 'production') {
    return storedEnvironment;
  }
  return defaultEnvironment ?? 'production';
}
