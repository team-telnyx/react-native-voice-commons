import type { TelnyxIceServer } from '@telnyx/react-native-voice-sdk';
export declare const ICE_SERVERS_STORAGE_KEY = '@ice_servers';
/**
 * Parse the ICE servers persisted by a previous login. A missing, malformed,
 * or structurally invalid value yields `undefined` (the core SDK then uses the
 * Telnyx defaults) rather than throwing, so a bad stored list never discards
 * otherwise valid stored authentication.
 */
export declare function parseStoredIceServers(stored: string | null): TelnyxIceServer[] | undefined;
