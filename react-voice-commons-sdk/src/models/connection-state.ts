/**
 * Represents the connection state to the Telnyx platform.
 *
 * This enum provides a simplified view of the connection status,
 * abstracting away the complexity of the underlying WebSocket states.
 */
export enum TelnyxConnectionState {
  /** Initial state before any connection attempt */
  DISCONNECTED = 'DISCONNECTED',

  /** Attempting to establish connection */
  CONNECTING = 'CONNECTING',

  /** Successfully connected and authenticated */
  CONNECTED = 'CONNECTED',

  /** Connection lost, attempting to reconnect */
  RECONNECTING = 'RECONNECTING',

  /** Connection failed or authentication error */
  ERROR = 'ERROR',
}

/**
 * Type guard to check if a value is a valid TelnyxConnectionState
 */
export function isTelnyxConnectionState(value: any): value is TelnyxConnectionState {
  return Object.values(TelnyxConnectionState).includes(value);
}

/**
 * Helper function to determine if the connection state allows making calls
 */
export function canMakeCalls(state: TelnyxConnectionState): boolean {
  return state === TelnyxConnectionState.CONNECTED;
}

/**
 * Helper function to determine if the connection state indicates an active connection
 */
export function isConnected(state: TelnyxConnectionState): boolean {
  return state === TelnyxConnectionState.CONNECTED;
}

/**
 * Helper function to determine if the connection is in a transitional state
 */
export function isTransitioning(state: TelnyxConnectionState): boolean {
  return state === TelnyxConnectionState.CONNECTING || state === TelnyxConnectionState.RECONNECTING;
}
