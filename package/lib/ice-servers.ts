/**
 * Default Telnyx ICE server configuration.
 *
 * Mirrors the JS SDK's ICE server constants (see
 * packages/js/src/Modules/Verto/util/constants/index.ts) so React Native
 * gets the same STUN → TURN UDP → TURN TCP → TURNS 443 relay coverage as
 * every sibling SDK.
 *
 * Credentials are the same shared TURN credentials used by all Telnyx SDKs.
 */

export interface TelnyxIceServer {
  urls: string;
  username?: string;
  credential?: string;
}

// ── Production ICE servers ──────────────────────────────────────────────

/** Primary Telnyx STUN server. */
export const STUN_SERVER: TelnyxIceServer = {
  urls: 'stun:stun.telnyx.com:3478',
};

/** Google STUN server for redundancy. */
export const GOOGLE_STUN_SERVER: TelnyxIceServer = {
  urls: 'stun:stun.l.google.com:19302',
};

/** Telnyx TURN over UDP (port 3478). */
export const TURN_UDP_3478_SERVER: TelnyxIceServer = {
  urls: 'turn:turn.telnyx.com:3478?transport=udp',
  username: 'testuser',
  credential: 'testpassword',
};

/** Telnyx TURN over TCP (port 3478). */
export const TURN_TCP_3478_SERVER: TelnyxIceServer = {
  urls: 'turn:turn.telnyx.com:3478?transport=tcp',
  username: 'testuser',
  credential: 'testpassword',
};

/** Telnyx TURN over TLS (port 443) — last-resort for restrictive firewalls. */
export const TURN_TLS_443_SERVER: TelnyxIceServer = {
  urls: 'turns:turn.telnyx.com:443',
  username: 'testuser',
  credential: 'testpassword',
};

/**
 * Default production ICE server set.
 *
 * Order: STUN (Telnyx) → STUN (Google redundancy) → TURN UDP → TURN TCP → TURNS 443.
 * This matches the JS SDK's `DEFAULT_PROD_ICE_SERVERS`.
 */
export const DEFAULT_PROD_ICE_SERVERS: TelnyxIceServer[] = [
  STUN_SERVER,
  GOOGLE_STUN_SERVER,
  TURN_UDP_3478_SERVER,
  TURN_TCP_3478_SERVER,
  TURN_TLS_443_SERVER,
];

// ── Development ICE servers ────────────────────────────────────────────

/** Dev Telnyx STUN server. */
export const STUN_DEV_SERVER: TelnyxIceServer = {
  urls: 'stun:stundev.telnyx.com:3478',
};

/** Dev Telnyx TURN over UDP. */
export const TURN_DEV_UDP_SERVER: TelnyxIceServer = {
  urls: 'turn:turndev.telnyx.com:3478?transport=udp',
  username: 'testuser',
  credential: 'testpassword',
};

/** Dev Telnyx TURN over TCP. */
export const TURN_DEV_TCP_SERVER: TelnyxIceServer = {
  urls: 'turn:turndev.telnyx.com:3478?transport=tcp',
  username: 'testuser',
  credential: 'testpassword',
};

/** Dev Telnyx TURN over TLS (port 443). */
export const TURN_DEV_TLS_443_SERVER: TelnyxIceServer = {
  urls: 'turns:turndev.telnyx.com:443',
  username: 'testuser',
  credential: 'testpassword',
};

/**
 * Default development ICE server set.
 * Mirrors the JS SDK's `DEFAULT_DEV_ICE_SERVERS`.
 */
export const DEFAULT_DEV_ICE_SERVERS: TelnyxIceServer[] = [
  STUN_DEV_SERVER,
  GOOGLE_STUN_SERVER,
  TURN_DEV_UDP_SERVER,
  TURN_DEV_TCP_SERVER,
  TURN_DEV_TLS_443_SERVER,
];

/**
 * Returns the appropriate default ICE servers for the given environment.
 *
 * @param isDev - If true, returns development servers; otherwise production.
 * @returns Array of ICE servers to use as the default configuration.
 */
export function getDefaultIceServers(isDev = false): TelnyxIceServer[] {
  return isDev ? DEFAULT_DEV_ICE_SERVERS : DEFAULT_PROD_ICE_SERVERS;
}
