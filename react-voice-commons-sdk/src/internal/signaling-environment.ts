import { TelnyxEnvironment } from '../models/config';

export const SIGNALING_ENVIRONMENT_STORAGE_KEY = '@telnyx_signaling_environment';

/**
 * Resolves the signaling environment for a stored-config restore.
 *
 * An explicit stored selection always wins. A missing or invalid stored value
 * (e.g. credentials persisted by an older Commons version) falls back to the
 * client's configured default, and only then to production.
 */
export function resolveStoredEnvironment(
  storedEnvironment: string | null | undefined,
  defaultEnvironment?: TelnyxEnvironment
): TelnyxEnvironment {
  if (storedEnvironment === 'development' || storedEnvironment === 'production') {
    return storedEnvironment;
  }
  return defaultEnvironment ?? 'production';
}
