import {
  TelnyxConnectionState,
  isTelnyxConnectionState,
  canMakeCalls,
  isConnected,
  isTransitioning,
} from '../../src/models/connection-state';

describe('TelnyxConnectionState', () => {
  describe('isTelnyxConnectionState', () => {
    it('should return true for valid connection states', () => {
      expect(isTelnyxConnectionState(TelnyxConnectionState.DISCONNECTED)).toBe(true);
      expect(isTelnyxConnectionState(TelnyxConnectionState.CONNECTING)).toBe(true);
      expect(isTelnyxConnectionState(TelnyxConnectionState.CONNECTED)).toBe(true);
      expect(isTelnyxConnectionState(TelnyxConnectionState.RECONNECTING)).toBe(true);
      expect(isTelnyxConnectionState(TelnyxConnectionState.ERROR)).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isTelnyxConnectionState('invalid')).toBe(false);
      expect(isTelnyxConnectionState(null)).toBe(false);
      expect(isTelnyxConnectionState(undefined)).toBe(false);
      expect(isTelnyxConnectionState(123)).toBe(false);
    });
  });

  describe('canMakeCalls', () => {
    it('should return true only for CONNECTED state', () => {
      expect(canMakeCalls(TelnyxConnectionState.CONNECTED)).toBe(true);
      expect(canMakeCalls(TelnyxConnectionState.DISCONNECTED)).toBe(false);
      expect(canMakeCalls(TelnyxConnectionState.CONNECTING)).toBe(false);
      expect(canMakeCalls(TelnyxConnectionState.RECONNECTING)).toBe(false);
      expect(canMakeCalls(TelnyxConnectionState.ERROR)).toBe(false);
    });
  });

  describe('isConnected', () => {
    it('should return true only for CONNECTED state', () => {
      expect(isConnected(TelnyxConnectionState.CONNECTED)).toBe(true);
      expect(isConnected(TelnyxConnectionState.DISCONNECTED)).toBe(false);
      expect(isConnected(TelnyxConnectionState.CONNECTING)).toBe(false);
      expect(isConnected(TelnyxConnectionState.RECONNECTING)).toBe(false);
      expect(isConnected(TelnyxConnectionState.ERROR)).toBe(false);
    });
  });

  describe('isTransitioning', () => {
    it('should return true for transitional states', () => {
      expect(isTransitioning(TelnyxConnectionState.CONNECTING)).toBe(true);
      expect(isTransitioning(TelnyxConnectionState.RECONNECTING)).toBe(true);
      expect(isTransitioning(TelnyxConnectionState.CONNECTED)).toBe(false);
      expect(isTransitioning(TelnyxConnectionState.DISCONNECTED)).toBe(false);
      expect(isTransitioning(TelnyxConnectionState.ERROR)).toBe(false);
    });
  });
});
