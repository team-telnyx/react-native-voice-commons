import { TelnyxRTC } from '../lib/client';

// Mock dependencies
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock('../lib/connection');
jest.mock('../lib/login-handler');
jest.mock('../lib/keep-alive-handler');

describe('TelnyxRTC Multi-Call Support', () => {
  let client: TelnyxRTC;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new TelnyxRTC({ logLevel: 'debug' });
  });

  function createMockCall(callId: string, state: string = 'active', direction: string = 'inbound') {
    return {
      callId,
      state,
      direction,
      on: jest.fn(),
      off: jest.fn(),
      hangup: jest.fn(),
      answer: jest.fn(),
      setDropped: jest.fn(),
      disposePeer: jest.fn(),
    };
  }

  describe('calls Map', () => {
    it('should track multiple simultaneous calls', () => {
      const call1 = createMockCall('call-1');
      const call2 = createMockCall('call-2');

      client.calls.set('call-1', call1 as any);
      client.calls.set('call-2', call2 as any);

      expect(client.calls.size).toBe(2);
      expect(client.calls.get('call-1')).toBe(call1);
      expect(client.calls.get('call-2')).toBe(call2);
    });

    it('should retrieve a specific call by ID using getCall()', () => {
      const call1 = createMockCall('call-1');
      const call2 = createMockCall('call-2');

      client.calls.set('call-1', call1 as any);
      client.calls.set('call-2', call2 as any);

      expect(client.getCall('call-1')).toBe(call1);
      expect(client.getCall('call-2')).toBe(call2);
      expect(client.getCall('nonexistent')).toBeNull();
    });
  });

  describe('call getter (backward compatibility)', () => {
    it('should return the first active call', () => {
      const call1 = createMockCall('call-1', 'active');
      const call2 = createMockCall('call-2', 'ringing');

      client.calls.set('call-1', call1 as any);
      client.calls.set('call-2', call2 as any);

      expect(client.call).toBe(call1);
    });

    it('should skip ended calls', () => {
      const call1 = createMockCall('call-1', 'ended');
      const call2 = createMockCall('call-2', 'active');

      client.calls.set('call-1', call1 as any);
      client.calls.set('call-2', call2 as any);

      expect(client.call).toBe(call2);
    });

    it('should include dropped calls (dropped = lost connectivity, still active)', () => {
      const call1 = createMockCall('call-1', 'dropped');

      client.calls.set('call-1', call1 as any);

      expect(client.call).toBe(call1);
    });

    it('should return null when all calls are ended', () => {
      const call1 = createMockCall('call-1', 'ended');
      const call2 = createMockCall('call-2', 'ended');

      client.calls.set('call-1', call1 as any);
      client.calls.set('call-2', call2 as any);

      expect(client.call).toBeNull();
    });
  });

  describe('getActiveCalls()', () => {
    it('should return all non-ended calls', () => {
      const call1 = createMockCall('call-1', 'active');
      const call2 = createMockCall('call-2', 'ended');
      const call3 = createMockCall('call-3', 'ringing');
      const call4 = createMockCall('call-4', 'dropped');

      client.calls.set('call-1', call1 as any);
      client.calls.set('call-2', call2 as any);
      client.calls.set('call-3', call3 as any);
      client.calls.set('call-4', call4 as any);

      const activeCalls = client.getActiveCalls();
      expect(activeCalls).toHaveLength(3);
      expect(activeCalls).toContain(call1);
      expect(activeCalls).toContain(call3);
      expect(activeCalls).toContain(call4);
    });

    it('should return empty array when no active calls', () => {
      const call1 = createMockCall('call-1', 'ended');
      client.calls.set('call-1', call1 as any);

      expect(client.getActiveCalls()).toHaveLength(0);
    });

    it('should include dropped calls since they may reconnect', () => {
      const call1 = createMockCall('call-1', 'dropped');

      client.calls.set('call-1', call1 as any);

      const activeCalls = client.getActiveCalls();
      expect(activeCalls).toHaveLength(1);
      expect(activeCalls).toContain(call1);
    });
  });

  describe('hasActiveCalls', () => {
    it('should return true when there are active calls', () => {
      const call1 = createMockCall('call-1', 'active');
      client.calls.set('call-1', call1 as any);

      expect(client.hasActiveCalls).toBe(true);
    });

    it('should return false when all calls are ended', () => {
      const call1 = createMockCall('call-1', 'ended');
      client.calls.set('call-1', call1 as any);

      expect(client.hasActiveCalls).toBe(false);
    });

    it('should return true for dropped calls (lost connectivity, still active)', () => {
      const call1 = createMockCall('call-1', 'dropped');
      client.calls.set('call-1', call1 as any);

      expect(client.hasActiveCalls).toBe(true);
    });

    it('should return false when calls map is empty', () => {
      expect(client.hasActiveCalls).toBe(false);
    });
  });

  describe('state filtering consistency', () => {
    it('should use same definition of active across call, getActiveCalls, and hasActiveCalls', () => {
      const endedCall = createMockCall('call-ended', 'ended');
      const droppedCall = createMockCall('call-dropped', 'dropped');
      const activeCall = createMockCall('call-active', 'active');

      client.calls.set('call-ended', endedCall as any);
      client.calls.set('call-dropped', droppedCall as any);
      client.calls.set('call-active', activeCall as any);

      // All three should agree on what's active
      // Dropped calls are still active (lost connectivity but may reconnect)
      const activeCalls = client.getActiveCalls();
      expect(activeCalls).toHaveLength(2);
      expect(activeCalls).toContain(droppedCall);
      expect(activeCalls).toContain(activeCall);
      expect(client.hasActiveCalls).toBe(true);
      // call getter returns first non-ended call
      expect(client.call).not.toBeNull();
    });

    it('should consistently return no active calls when all ended', () => {
      const endedCall1 = createMockCall('call-ended-1', 'ended');
      const endedCall2 = createMockCall('call-ended-2', 'ended');

      client.calls.set('call-ended-1', endedCall1 as any);
      client.calls.set('call-ended-2', endedCall2 as any);

      expect(client.call).toBeNull();
      expect(client.getActiveCalls()).toHaveLength(0);
      expect(client.hasActiveCalls).toBe(false);
    });
  });
});
