jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: { currentState: 'active' },
  NativeModules: { VoicePnBridge: {} },
  NativeEventEmitter: jest.fn().mockImplementation(() => ({
    addListener: jest.fn(),
    removeAllListeners: jest.fn(),
  })),
}));

jest.mock('../../src/internal/voice-pn-bridge', () => ({
  VoicePnBridge: {
    getPendingVoipPush: jest.fn().mockResolvedValue(null),
    clearPendingVoipPush: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/callkit/callkit', () => ({
  __esModule: true,
  default: {
    isAvailable: jest.fn(() => false),
    reportCallEnded: jest.fn().mockResolvedValue(true),
    reportCallConnected: jest.fn().mockResolvedValue(true),
    completeHeldCallAction: jest.fn().mockResolvedValue(true),
    isCallRegistered: jest.fn().mockResolvedValue(true),
    answerCall: jest.fn().mockResolvedValue(true),
    startOutgoingCall: jest.fn().mockResolvedValue(true),
  },
  CallEndReason: { Failed: 1 },
}));

import CallKit from '../../src/callkit/callkit';
import { callKitCoordinator } from '../../src/callkit/callkit-coordinator';

// Exercise the real coordinator; only native CallKit and call signaling are mocked.
describe('CallKitCoordinator call waiting', () => {
  const coordinator = callKitCoordinator as any;

  const makeCall = (callId: string) => {
    const call = {
      callId,
      _callKitUUID: callId,
      direction: 'inbound',
      state: 'ringing',
      answer: jest.fn(async () => {
        call.state = 'active';
      }),
      hold: jest.fn(async () => {
        call.state = 'held';
      }),
      unhold: jest.fn(async () => {
        call.state = 'active';
      }),
      hangup: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      removeListener: jest.fn(),
    };
    coordinator.callMap.set(callId, call);
    coordinator.setupWebRTCCallListeners(call, callId);
    return call;
  };

  const emitState = async (call: ReturnType<typeof makeCall>, state: string) => {
    call.state = state;
    const listener = call.on.mock.calls.find(([event]) => event === 'telnyx.call.state')![1];
    await listener(call, state);
  };

  beforeEach(() => {
    coordinator.voipClient = {
      setCallConnecting: jest.fn(),
      findCallByTelnyxCall: jest.fn((call) => ({ callId: call.callId })),
      setActiveCall: jest.fn(),
    };
  });

  afterEach(() => {
    for (const uuid of Array.from(coordinator.callMap.keys())) {
      coordinator.cleanupCall(uuid);
    }
    coordinator.voipClient = null;
    jest.clearAllMocks();
  });

  it('answers B after A is held without ending either call', async () => {
    const a = makeCall('call-a');
    const b = makeCall('call-b');
    await callKitCoordinator.handleCallKitAnswer(a.callId);
    await emitState(a, 'active');
    await callKitCoordinator.handleCallKitHeld(a.callId, true);
    await emitState(a, 'held');
    await callKitCoordinator.handleCallKitAnswer(b.callId);
    await emitState(b, 'active');

    expect(a.state).toBe('held');
    expect(b.answer).toHaveBeenCalledTimes(1);
    expect(b.state).toBe('active');
    expect(CallKit.reportCallConnected).toHaveBeenCalledWith(b.callId);
    expect(CallKit.reportCallEnded).not.toHaveBeenCalled();
    expect(a.hangup).not.toHaveBeenCalled();
    expect(b.hangup).not.toHaveBeenCalled();
    expect(callKitCoordinator.getWebRTCCall(b.callId)).toBe(b);
    expect(coordinator.voipClient.setActiveCall).toHaveBeenLastCalledWith(b.callId);
  });

  it('does not reject B while the CallKit hold action for A is still completing', async () => {
    const a = makeCall('call-a');
    const b = makeCall('call-b');
    await callKitCoordinator.handleCallKitAnswer(a.callId);
    let finishHold!: () => void;
    a.hold.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishHold = () => {
            a.state = 'held';
            resolve();
          };
        })
    );

    const holding = callKitCoordinator.handleCallKitHeld(a.callId, true);
    expect(a.state).toBe('active');
    await callKitCoordinator.handleCallKitAnswer(b.callId);
    await emitState(b, 'active');
    finishHold();
    await holding;

    expect(a.state).toBe('held');
    expect(b.answer).toHaveBeenCalledTimes(1);
    expect(CallKit.completeHeldCallAction).toHaveBeenCalledWith(a.callId, true);
    expect(CallKit.reportCallEnded).not.toHaveBeenCalled();
    expect(b.hangup).not.toHaveBeenCalled();
  });

  it('keeps both calls usable through native hold and resume in both swap directions', async () => {
    const a = makeCall('call-a');
    const b = makeCall('call-b');
    await callKitCoordinator.handleCallKitAnswer(a.callId);
    await callKitCoordinator.handleCallKitHeld(a.callId, true);
    await callKitCoordinator.handleCallKitAnswer(b.callId);
    await emitState(b, 'active');

    await callKitCoordinator.handleCallKitHeld(b.callId, true);
    await callKitCoordinator.handleCallKitHeld(a.callId, false);
    await emitState(a, 'active');
    expect(a.state).toBe('active');
    expect(b.state).toBe('held');

    await callKitCoordinator.handleCallKitHeld(a.callId, true);
    await callKitCoordinator.handleCallKitHeld(b.callId, false);
    await emitState(b, 'active');
    expect(a.state).toBe('held');
    expect(b.state).toBe('active');
    expect(CallKit.reportCallEnded).not.toHaveBeenCalled();
    expect(a.hangup).not.toHaveBeenCalled();
    expect(b.hangup).not.toHaveBeenCalled();
  });

  it('still ignores a duplicate answer action for the same call while answering', async () => {
    const a = makeCall('call-a');
    let finishAnswer!: () => void;
    a.answer.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishAnswer = () => {
            a.state = 'active';
            resolve();
          };
        })
    );
    const answering = callKitCoordinator.handleCallKitAnswer(a.callId);
    await callKitCoordinator.handleCallKitAnswer(a.callId);
    expect(a.answer).toHaveBeenCalledTimes(1);
    finishAnswer();
    await answering;
    await callKitCoordinator.handleCallKitAnswer(a.callId);
    expect(a.answer).toHaveBeenCalledTimes(1);
    expect(CallKit.reportCallEnded).not.toHaveBeenCalled();
  });

  it('allows the app answer path for B after A has been held', async () => {
    const a = makeCall('call-a');
    const b = makeCall('call-b');
    await callKitCoordinator.handleCallKitAnswer(a.callId);
    await callKitCoordinator.handleCallKitHeld(a.callId, true);

    expect(await callKitCoordinator.answerCallFromUI(b as any)).toBe(true);
    expect(CallKit.answerCall).toHaveBeenCalledWith(b.callId);
    await callKitCoordinator.handleCallKitAnswer(b.callId);
    expect(b.answer).toHaveBeenCalledTimes(1);
    expect(b.hangup).not.toHaveBeenCalled();
  });

  it('registers a second outgoing call while the existing call is held', async () => {
    const a = makeCall('call-a');
    await callKitCoordinator.handleCallKitAnswer(a.callId);
    await callKitCoordinator.handleCallKitHeld(a.callId, true);
    const b = makeCall('call-b');
    coordinator.callMap.delete(b.callId);
    b.direction = 'outbound';
    (CallKit.isAvailable as jest.Mock).mockReturnValueOnce(true);

    expect(await callKitCoordinator.startOutgoingCall(b as any, 'test-destination')).toBe(b.callId);
    expect(callKitCoordinator.getWebRTCCall(b.callId)).toBe(b);
    expect(b.hangup).not.toHaveBeenCalled();
    expect(CallKit.reportCallEnded).not.toHaveBeenCalled();
  });

  it('queues the answer for B before its INVITE arrives while A is held', async () => {
    const a = makeCall('call-a');
    await callKitCoordinator.handleCallKitAnswer(a.callId);
    await callKitCoordinator.handleCallKitHeld(a.callId, true);
    coordinator.voipClient.queueAnswerFromCallKit = jest.fn();
    coordinator.pendingPushCallUUIDs.add('call-b');

    await callKitCoordinator.handleCallKitAnswer('call-b');
    expect(coordinator.voipClient.queueAnswerFromCallKit).toHaveBeenCalledWith('call-b');
    const b = makeCall('call-b');
    await callKitCoordinator.handleCallKitAnswer(b.callId);
    expect(b.answer).toHaveBeenCalledTimes(1);
    expect(b.hangup).not.toHaveBeenCalled();
    expect(CallKit.reportCallEnded).not.toHaveBeenCalled();
  });

  it('does not end a second outgoing call when another call is held', async () => {
    const a = makeCall('call-a');
    await callKitCoordinator.handleCallKitAnswer(a.callId);
    await callKitCoordinator.handleCallKitHeld(a.callId, true);
    const b = makeCall('call-b');
    b.direction = 'outbound';
    await emitState(b, 'active');

    expect(CallKit.reportCallConnected).toHaveBeenCalledWith(b.callId);
    expect(CallKit.reportCallEnded).not.toHaveBeenCalled();
    expect(b.hangup).not.toHaveBeenCalled();
  });
});
