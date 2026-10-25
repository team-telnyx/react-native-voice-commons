import type { TelnyxIceServer } from '@telnyx/react-native-voice-sdk';

export const ICE_SERVERS_STORAGE_KEY = '@ice_servers';

/**
 * Parse the ICE servers persisted by a previous login. A missing, malformed,
 * or structurally invalid value yields `undefined` (the core SDK then uses the
 * Telnyx defaults) rather than throwing, so a bad stored list never discards
 * otherwise valid stored authentication.
 */
export function parseStoredIceServers(stored: string | null): TelnyxIceServer[] | undefined {
  if (!stored) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isIceServer)) {
      return parsed;
    }
  } catch {
    // Fall through to the warning below.
  }
  console.warn('Ignoring invalid stored ICE servers; using the SDK defaults');
  return undefined;
}

function isIceServer(value: unknown): value is TelnyxIceServer {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const server = value as Record<string, unknown>;
  return (
    typeof server.urls === 'string' &&
    (server.username === undefined || typeof server.username === 'string') &&
    (server.credential === undefined || typeof server.credential === 'string')
  );
}
