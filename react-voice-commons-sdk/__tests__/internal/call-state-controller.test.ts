import { CallStateController } from '../../src/internal/calls/call-state-controller';
import { TelnyxCallState } from '../../src/models/call-state';
import type { Call } from '../../src/models/call';

jest.mock('../../src/callkit/callkit-coordinator', () => ({
  callKitCoordinator: {
    isAvailable: jest.fn(() => false),
    getCallKitUUID: jest.fn(() => null),
    reportIncomingCall: jest.fn(),
    startOutgoingCall: jest.fn(),
  },
}));

jest.mock('../../src/internal/voice-pn-bridge', () => ({
  VoicePnBridge: {
    clearPendingVoipPush: jest.fn(() => Promise.resolve()),
    endCall: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../../src/internal/session/session-manager', () => {
  return jest.fn().mockImplementation(() => ({
    telnyxClient: null,
    useTrickleIce: false,
  }));
});

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
    return controller.currentCalls[controller.currentCalls.length - 1];
  }

  describe('calls$ re-emission on call state change (VSDK-345)', () => {
    it('should re-emit calls$ when a tracked call transitions to CONNECTING', () => {
      const { call: mockCall, triggerState } = createMockTelnyxCall('call-1');
      addIncomingCall(mockCall);

      const emissions: Call[][] = [];
      controller.calls$.subscribe((calls) => emissions.push([...calls]));

      expect(emissions.length).toBe(1);
      expect(emissions[0].length).toBe(1);

      triggerState('connecting');

      expect(emissions.length).toBe(2);
    });

    it('should re-emit activeCall$ when the active call transitions to CONNECTING', () => {
      const { call: mockCall, triggerState } = createMockTelnyxCall('call-1');
      addIncomingCall(mockCall);

      const emissions: (Call | null)[] = [];
      controller.activeCall$.subscribe((call) => emissions.push(call));

      expect(emissions.length).toBe(1);
      expect(emissions[0]?.currentState).toBe(TelnyxCallState.RINGING);

      triggerState('connecting');

      expect(emissions.length).toBe(2);
      expect(emissions[1]?.callId).toBe('call-1');
      expect(emissions[1]?.currentState).toBe(TelnyxCallState.CONNECTING);
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

      expect(activeCallValues.length).toBe(1);
      expect(activeCallValues[0]).not.toBeNull();

      triggerState('ended');

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

      expect(activeCallValues.length).toBe(1);
      expect(activeCallValues[0]?.callId).toBe('call-1');

      mock1.triggerState('ended');

      expect(activeCallValues.length).toBe(2);
      expect(activeCallValues[1]?.callId).toBe('call-2');
    });
  });

  describe('explicit active call tracking via setActiveCall', () => {
    it('should switch currentActiveCall to the explicitly-tracked call', () => {
      const mock1 = createMockTelnyxCall('call-1');
      const mock2 = createMockTelnyxCall('call-2');

      addIncomingCall(mock1.call);
      addIncomingCall(mock2.call);

      expect(controller.currentActiveCall?.callId).toBe('call-1');

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

      expect(activeCallValues[activeCallValues.length - 1]?.callId).toBe('call-1');

      controller.setActiveCall('call-2');

      expect(activeCallValues[activeCallValues.length - 1]?.callId).toBe('call-2');
    });

    it('should keep the tracked call even when it is not first in the array', () => {
      const mock1 = createMockTelnyxCall('call-1');
      const mock2 = createMockTelnyxCall('call-2');

      addIncomingCall(mock1.call);
      addIncomingCall(mock2.call);

      controller.setActiveCall('call-2');

      expect(controller.currentActiveCall?.callId).toBe('call-2');
    });

    it('should clear the tracked ID when the tracked call ends', () => {
      const mock1 = createMockTelnyxCall('call-1');
      const mock2 = createMockTelnyxCall('call-2');

      addIncomingCall(mock1.call);
      addIncomingCall(mock2.call);

      controller.setActiveCall('call-1');
      expect(controller.currentActiveCall?.callId).toBe('call-1');

      mock1.triggerState('ended');
      jest.runAllTimers();

      expect(controller.currentActiveCall?.callId).toBe('call-2');
    });

    it('should not affect active call when a non-tracked call ends', () => {
      const mock1 = createMockTelnyxCall('call-1');
      const mock2 = createMockTelnyxCall('call-2');

      addIncomingCall(mock1.call);
      addIncomingCall(mock2.call);

      controller.setActiveCall('call-2');
      expect(controller.currentActiveCall?.callId).toBe('call-2');

      mock1.triggerState('ended');
      jest.runAllTimers();

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

      expect(emissions.length).toBe(countBefore);
    });
  });

  describe('auto-tracking on add', () => {
    it('should auto-track the first call as active', () => {
      const mock1 = createMockTelnyxCall('call-1');
      addIncomingCall(mock1.call);

      expect(controller.currentActiveCall?.callId).toBe('call-1');
    });

    it('should not override an existing tracked call when adding a new call', () => {
      const mock1 = createMockTelnyxCall('call-1');
      addIncomingCall(mock1.call);

      controller.setActiveCall('call-1');

      const mock2 = createMockTelnyxCall('call-2');
      addIncomingCall(mock2.call);

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

      expect(controller.currentActiveCall).toBeNull();

      const mock2 = createMockTelnyxCall('call-2');
      addIncomingCall(mock2.call);
      expect(controller.currentActiveCall?.callId).toBe('call-2');
    });
  });
});
