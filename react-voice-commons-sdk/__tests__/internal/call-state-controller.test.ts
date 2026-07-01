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

describe('CallStateController — active call selection (VSDK-346)', () => {
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
    return controller.currentCalls[controller.currentCalls.length - 1];
  }

  describe('backward-compatible first-match (no setActiveCall)', () => {
    it('should return the first non-terminal call as currentActiveCall', () => {
      const mock1 = createMockTelnyxCall('call-1');
      const mock2 = createMockTelnyxCall('call-2');

      addIncomingCall(mock1.call);
      addIncomingCall(mock2.call);

      // Both RINGING — first-match returns call-1
      expect(controller.currentActiveCall?.callId).toBe('call-1');
    });

    it('should fall back to the next non-terminal call when the first ends', () => {
      const mock1 = createMockTelnyxCall('call-1');
      const mock2 = createMockTelnyxCall('call-2');

      addIncomingCall(mock1.call);
      addIncomingCall(mock2.call);

      expect(controller.currentActiveCall?.callId).toBe('call-1');

      // End call-1
      mock1.triggerState('ended');
      jest.runAllTimers();

      // Should fall back to call-2
      expect(controller.currentActiveCall?.callId).toBe('call-2');
    });
  });

  describe('explicit active call tracking via setActiveCall', () => {
    it('should switch currentActiveCall to the explicitly-tracked call', () => {
      const mock1 = createMockTelnyxCall('call-1');
      const mock2 = createMockTelnyxCall('call-2');

      addIncomingCall(mock1.call);
      addIncomingCall(mock2.call);

      // Default: first-match returns call-1
      expect(controller.currentActiveCall?.callId).toBe('call-1');

      // Explicitly set call-2 as active
      controller.setActiveCall('call-2');
      expect(controller.currentActiveCall?.callId).toBe('call-2');
    });

    it('should emit the tracked call on activeCall$', () => {
      const mock1 = createMockTelnyxCall('call-1');
      const mock2 = createMockTelnyxCall('call-2');

      addIncomingCall(mock1.call);
      addIncomingCall(mock2.call);

      const activeCallValues: (Call | null)[] = [];
      controller.activeCall$.subscribe((call) => activeCallValues.push(call));

      // Initial: first-match returns call-1
      expect(activeCallValues[activeCallValues.length - 1]?.callId).toBe('call-1');

      // Switch to call-2
      controller.setActiveCall('call-2');

      // activeCall$ should emit call-2
      expect(activeCallValues[activeCallValues.length - 1]?.callId).toBe('call-2');
    });

    it('should keep the tracked call even when it is not first in the array', () => {
      const mock1 = createMockTelnyxCall('call-1');
      const mock2 = createMockTelnyxCall('call-2');

      addIncomingCall(mock1.call);
      addIncomingCall(mock2.call);

      controller.setActiveCall('call-2');

      // Even though call-1 is first and non-terminal, tracked call-2 wins
      expect(controller.currentActiveCall?.callId).toBe('call-2');
    });

    it('should clear the tracked ID when the tracked call ends', () => {
      const mock1 = createMockTelnyxCall('call-1');
      const mock2 = createMockTelnyxCall('call-2');

      addIncomingCall(mock1.call);
      addIncomingCall(mock2.call);

      controller.setActiveCall('call-1');
      expect(controller.currentActiveCall?.callId).toBe('call-1');

      // End the tracked call
      mock1.triggerState('ended');
      jest.runAllTimers();

      // Should fall back to call-2 (first-match with _activeCallId cleared)
      expect(controller.currentActiveCall?.callId).toBe('call-2');
    });

    it('should not affect active call when a non-tracked call ends', () => {
      const mock1 = createMockTelnyxCall('call-1');
      const mock2 = createMockTelnyxCall('call-2');

      addIncomingCall(mock1.call);
      addIncomingCall(mock2.call);

      controller.setActiveCall('call-2');
      expect(controller.currentActiveCall?.callId).toBe('call-2');

      // End call-1 (not the tracked call)
      mock1.triggerState('ended');
      jest.runAllTimers();

      // Tracked call-2 should still be active
      expect(controller.currentActiveCall?.callId).toBe('call-2');
    });
  });

  describe('clearActiveCall', () => {
    it('should revert to first-match after clearing the tracked call', () => {
      const mock1 = createMockTelnyxCall('call-1');
      const mock2 = createMockTelnyxCall('call-2');

      addIncomingCall(mock1.call);
      addIncomingCall(mock2.call);

      controller.setActiveCall('call-2');
      expect(controller.currentActiveCall?.callId).toBe('call-2');

      controller.clearActiveCall();
      expect(controller.currentActiveCall?.callId).toBe('call-1');
    });

    it('should be a no-op when no active call is tracked', () => {
      const mock1 = createMockTelnyxCall('call-1');
      addIncomingCall(mock1.call);

      const emissions: (Call | null)[] = [];
      controller.activeCall$.subscribe((c) => emissions.push(c));
      const countBefore = emissions.length;

      controller.clearActiveCall();

      // No re-emission since _activeCallId was already null
      expect(emissions.length).toBe(countBefore);
    });
  });

  describe('auto-tracking on add', () => {
    it('should auto-track the first call as active', () => {
      const mock1 = createMockTelnyxCall('call-1');
      addIncomingCall(mock1.call);

      // currentActiveCall should return the auto-tracked call
      expect(controller.currentActiveCall?.callId).toBe('call-1');
    });

    it('should not override an existing tracked call when adding a new call', () => {
      const mock1 = createMockTelnyxCall('call-1');
      addIncomingCall(mock1.call);

      // Set call-1 explicitly
      controller.setActiveCall('call-1');

      const mock2 = createMockTelnyxCall('call-2');
      addIncomingCall(mock2.call);

      // Active call should still be call-1, not auto-switched to call-2
      expect(controller.currentActiveCall?.callId).toBe('call-1');
    });
  });

  describe('setActiveCall with invalid call ID', () => {
    it('should warn and keep the existing active call', () => {
      const mock1 = createMockTelnyxCall('call-1');
      addIncomingCall(mock1.call);

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      controller.setActiveCall('nonexistent');
      expect(warnSpy).toHaveBeenCalledWith(
        'CallStateController: Cannot set active call - call not found:',
        'nonexistent'
      );

      // Active call unchanged
      expect(controller.currentActiveCall?.callId).toBe('call-1');

      warnSpy.mockRestore();
    });
  });

  describe('clearAllCalls resets active call tracking', () => {
    it('should reset _activeCallId when all calls are cleared', () => {
      const mock1 = createMockTelnyxCall('call-1');
      addIncomingCall(mock1.call);

      controller.setActiveCall('call-1');
      expect(controller.currentActiveCall?.callId).toBe('call-1');

      (controller as any).clearAllCalls();

      // After clearing, no active call
      expect(controller.currentActiveCall).toBeNull();

      // Adding a new call should auto-track it (proves _activeCallId was reset)
      const mock2 = createMockTelnyxCall('call-2');
      addIncomingCall(mock2.call);
      expect(controller.currentActiveCall?.callId).toBe('call-2');
    });
  });
});
