import { CallStateController } from '../../src/internal/calls/call-state-controller';
import { TelnyxCallState } from '../../src/models/call-state';
import type { Call } from '../../src/models/call';

// Mock callkit-coordinator to avoid CallKit setup during tests
jest.mock('../../src/callkit/callkit-coordinator', () => ({
  callKitCoordinator: {
    isAvailable: jest.fn(() => false),
    getCallKitUUID: jest.fn(() => null),
    reportIncomingCall: jest.fn(),
    startOutgoingCall: jest.fn(),
  },
}));

// Mock voice-pn-bridge to avoid native module calls during tests
jest.mock('../../src/internal/voice-pn-bridge', () => ({
  VoicePnBridge: {
    clearPendingVoipPush: jest.fn(() => Promise.resolve()),
    endCall: jest.fn(() => Promise.resolve()),
  },
}));

// Mock session-manager — CallStateController only needs telnyxClient and useTrickleIce
jest.mock('../../src/internal/session/session-manager', () => {
  return jest.fn().mockImplementation(() => ({
    telnyxClient: null,
    useTrickleIce: false,
  }));
});

/**
 * Helper: create a mock TelnyxCall whose 'telnyx.call.state' callback can be
 * triggered externally to simulate state transitions.
 */
function createMockTelnyxCall(callId: string) {
  let stateCb: ((call: any, state: any) => void) | null = null;
  const call = {
    callId,
    on: jest.fn((event: string, cb: any) => {
      if (event === 'telnyx.call.state') {
        stateCb = cb;
      }
    }),
    off: jest.fn(),
    remoteCallerIdNumber: '1234567890',
    remoteCallerIdName: 'Test Caller',
  };
  return {
    call,
    triggerState: (state: string) => {
      if (stateCb) {
        stateCb(call, state);
      }
    },
  };
}

describe('CallStateController', () => {
  let controller: CallStateController;

  beforeEach(() => {
    jest.useFakeTimers();
    const mockSessionManager = {
      telnyxClient: null,
      useTrickleIce: false,
    } as any;
    controller = new CallStateController(mockSessionManager);
  });

  afterEach(() => {
    controller.dispose();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  function addIncomingCall(mockTelnyxCall: any): Call {
    (controller as any)._handleIncomingCall(mockTelnyxCall, {
      params: {
        caller_id_number: '1234567890',
        caller_id_name: 'Test Caller',
      },
    });
    return controller.currentCalls[0];
  }

  describe('calls$ re-emission on call state change (VSDK-345)', () => {
    it('should re-emit calls$ when a tracked call transitions to CONNECTING', () => {
      const { call: mockCall, triggerState } = createMockTelnyxCall('call-1');
      addIncomingCall(mockCall);

      const emissions: Call[][] = [];
      controller.calls$.subscribe((calls) => emissions.push([...calls]));

      // Initial emission from BehaviorSubject (1 call in RINGING)
      expect(emissions.length).toBe(1);
      expect(emissions[0].length).toBe(1);

      // Trigger non-terminal state change RINGING -> CONNECTING
      triggerState('connecting');

      // calls$ should have emitted a new array (new reference via spread)
      expect(emissions.length).toBe(2);
    });

    it('should re-emit calls$ when a tracked call transitions to ACTIVE', () => {
      const { call: mockCall, triggerState } = createMockTelnyxCall('call-1');
      addIncomingCall(mockCall);

      const emissions: Call[][] = [];
      controller.calls$.subscribe((calls) => emissions.push([...calls]));

      expect(emissions.length).toBe(1);

      triggerState('active');

      expect(emissions.length).toBe(2);
    });

    it('should make activeCall$ emit null immediately when the active call ends', () => {
      const { call: mockCall, triggerState } = createMockTelnyxCall('call-1');
      addIncomingCall(mockCall);

      const activeCallValues: (Call | null)[] = [];
      controller.activeCall$.subscribe((call) => activeCallValues.push(call));

      // Initially RINGING (non-terminal) — activeCall$ returns the call
      expect(activeCallValues.length).toBe(1);
      expect(activeCallValues[0]).not.toBeNull();

      // Transition to ENDED (terminal)
      triggerState('ended');

      // activeCall$ should emit null synchronously, before setTimeout fires
      expect(activeCallValues.length).toBe(2);
      expect(activeCallValues[1]).toBeNull();
    });

    it('should switch activeCall$ to the next non-terminal call when the first ends', () => {
      const mock1 = createMockTelnyxCall('call-1');
      const mock2 = createMockTelnyxCall('call-2');

      addIncomingCall(mock1.call);
      addIncomingCall(mock2.call);

      const activeCallValues: (Call | null)[] = [];
      controller.activeCall$.subscribe((call) => activeCallValues.push(call));

      // Both calls are RINGING; activeCall$ returns the first non-terminal match
      expect(activeCallValues.length).toBe(1);
      expect(activeCallValues[0]?.callId).toBe('call-1');

      // End the first call
      mock1.triggerState('ended');

      // activeCall$ should switch to call-2 synchronously
      expect(activeCallValues.length).toBe(2);
      expect(activeCallValues[1]?.callId).toBe('call-2');
    });

    it('should not re-emit when dispose is called (no stale emissions)', () => {
      const { call: mockCall, triggerState } = createMockTelnyxCall('call-1');
      addIncomingCall(mockCall);

      const emissions: Call[][] = [];
      const sub = controller.calls$.subscribe((calls) => emissions.push([...calls]));

      expect(emissions.length).toBe(1);

      sub.unsubscribe();
      controller.dispose();

      // After dispose, triggering state should not cause errors
      triggerState('connecting');

      // No new emissions expected (subject completed)
      expect(emissions.length).toBe(1);
    });
  });
});
