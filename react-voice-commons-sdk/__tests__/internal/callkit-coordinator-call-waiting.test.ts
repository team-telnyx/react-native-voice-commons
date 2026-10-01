import CallKit from '../../src/callkit/callkit';
import { callKitCoordinator } from '../../src/callkit/callkit-coordinator';
import { VoicePnBridge } from '../../src/internal/voice-pn-bridge';

jest.mock('../../src/internal/voice-pn-bridge', () => ({
  VoicePnBridge: {
    getPendingVoipPush: jest.fn(),
    clearPendingVoipPush: jest.fn().mockResolvedValue(true),
    setPendingPushAction: jest.fn().mockResolvedValue(true),
  },
}));

function lowLevelCall(callId: string, state: string) {
  return {
    callId,
    state,
    direction: 'inbound',
    hold: jest.fn().mockImplementation(async function (this: any) {
      this.state = 'held';
    }),
    unhold: jest.fn().mockImplementation(async function (this: any) {
      this.state = 'active';
    }),
    answer: jest.fn().mockResolvedValue(undefined),
    hangup: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
  } as any;
}

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('CallKitCoordinator UUID-targeted call waiting', () => {
  const coordinator = callKitCoordinator as any;

  beforeEach(() => {
    jest.clearAllMocks();
    coordinator.callMap.clear();
    coordinator.processingCalls.clear();
    coordinator.endedCalls.clear();
    coordinator.connectedCalls.clear();
    coordinator.pendingPushCallUUIDs.clear();
    coordinator.autoAnswerCallUUIDs.clear();
    coordinator.selectedCallKitUUID = null;
    coordinator.voipClient = null;
    for (const request of coordinator.pendingHeldRequests.values()) {
      clearTimeout(request.timeout);
    }
    coordinator.pendingHeldRequests.clear();
    if (coordinator.pendingSwap) {
      clearTimeout(coordinator.pendingSwap.timeout);
      coordinator.pendingSwap = null;
    }
    (VoicePnBridge.getPendingVoipPush as jest.Mock).mockResolvedValue(null);
    (VoicePnBridge.clearPendingVoipPush as jest.Mock).mockResolvedValue(true);
    jest.spyOn(CallKit, 'isAvailable').mockReturnValue(true);
    jest.spyOn(CallKit, 'isCallRegistered').mockResolvedValue(true);
    jest.spyOn(CallKit, 'reportIncomingCall').mockResolvedValue(true);
    jest.spyOn(CallKit, 'completeHeldCallAction').mockResolvedValue(true);
    jest.spyOn(CallKit, 'setCallHeld').mockResolvedValue(true);
    jest.spyOn(CallKit, 'swapCalls').mockResolvedValue(true);
    jest.spyOn(CallKit, 'endCall').mockResolvedValue(true);
    jest.spyOn(CallKit, 'reportCallConnected').mockResolvedValue(true);
    jest.spyOn(CallKit, 'reportCallEnded').mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('holds only the call identified by the CallKit UUID', async () => {
    const first = lowLevelCall('signal-a', 'active');
    const second = lowLevelCall('signal-b', 'active');
    coordinator.callMap.set('callkit-a', first);
    coordinator.callMap.set('callkit-b', second);

    await callKitCoordinator.handleCallKitHeld('CALLKIT-A', true);

    expect(first.hold).toHaveBeenCalledTimes(1);
    expect(second.hold).not.toHaveBeenCalled();
    expect(CallKit.completeHeldCallAction).toHaveBeenCalledWith('callkit-a', true);
  });

  it('fails an unknown UUID without modifying another call', async () => {
    const existing = lowLevelCall('signal-a', 'active');
    coordinator.callMap.set('callkit-a', existing);

    await callKitCoordinator.handleCallKitHeld('missing-call', true);

    expect(existing.hold).not.toHaveBeenCalled();
    expect(existing.unhold).not.toHaveBeenCalled();
    expect(CallKit.completeHeldCallAction).toHaveBeenCalledWith('missing-call', false);
  });

  it('ends and unmaps a signaling call when CallKit rejects incoming registration', async () => {
    const call = lowLevelCall('f8cb65d9-8b26-4992-bec1-be0afab4c4bb', 'ringing');
    (CallKit.reportIncomingCall as jest.Mock).mockResolvedValue(false);

    await expect(
      callKitCoordinator.reportIncomingCall(call, 'Focus caller', 'focus-caller')
    ).resolves.toBeNull();

    expect(call.hangup).toHaveBeenCalledTimes(1);
    expect(coordinator.callMap.has(call.callId)).toBe(false);
    expect((call as any)._callKitUUID).toBeUndefined();
  });

  it('does not submit an answer transaction for a rejected CallKit UUID', async () => {
    const call = lowLevelCall('signal-focus', 'ringing');
    Object.defineProperty(call, '_callKitUUID', {
      value: 'callkit-focus',
      writable: false,
      configurable: false,
    });
    coordinator.callMap.set('callkit-focus', call);
    (CallKit.isCallRegistered as jest.Mock).mockResolvedValue(false);
    const answerCall = jest.spyOn(CallKit, 'answerCall').mockResolvedValue(true);

    await expect(callKitCoordinator.answerCallFromUI(call)).resolves.toBe(false);

    expect(answerCall).not.toHaveBeenCalled();
    expect(call.answer).not.toHaveBeenCalled();
    expect(call.hangup).toHaveBeenCalledTimes(1);
    expect(coordinator.callMap.has('callkit-focus')).toBe(false);
  });

  it('clears the matching persisted push after an in-app answer succeeds', async () => {
    const call = lowLevelCall('signal-b', 'ringing');
    (call as any)._callKitUUID = 'callkit-b';
    coordinator.callMap.set('callkit-b', call);
    coordinator.pendingPushCallUUIDs.add('callkit-b');
    (VoicePnBridge.getPendingVoipPush as jest.Mock).mockResolvedValue(
      JSON.stringify({
        payload: { metadata: { call_id: 'CALLKIT-B', voice_sdk_id: 'voice-sdk-b' } },
      })
    );
    jest.spyOn(CallKit, 'answerCall').mockResolvedValue(true);

    await expect(callKitCoordinator.answerCallFromUI(call)).resolves.toBe(true);

    expect(call.answer).toHaveBeenCalledTimes(1);
    expect(VoicePnBridge.clearPendingVoipPush).toHaveBeenCalledTimes(1);
    expect(coordinator.pendingPushCallUUIDs.has('callkit-b')).toBe(false);
  });

  it('selects the exact call after a successful resume', async () => {
    const held = lowLevelCall('signal-b', 'held');
    const wrapper = { callId: 'signal-b' };
    const voipClient = {
      findCallByTelnyxCall: jest.fn(() => wrapper),
      setActiveCall: jest.fn(),
    };
    coordinator.voipClient = voipClient;
    coordinator.callMap.set('callkit-b', held);
    (held as any)._callKitUUID = 'callkit-b';

    await callKitCoordinator.handleCallKitHeld('callkit-b', false);

    expect(held.unhold).toHaveBeenCalledTimes(1);
    expect(voipClient.setActiveCall).toHaveBeenCalledWith('signal-b');
  });

  it('routes an app hold request through CallKit and waits for signaling completion', async () => {
    const first = lowLevelCall('signal-a', 'active');
    (first as any)._callKitUUID = 'callkit-a';
    coordinator.callMap.set('callkit-a', first);

    const request = callKitCoordinator.setHeldFromUI(first, true);
    await flushMicrotasks();

    expect(CallKit.setCallHeld).toHaveBeenCalledWith('callkit-a', true);

    await callKitCoordinator.handleCallKitHeld('callkit-a', true);

    await expect(request).resolves.toBe(true);
    expect(first.hold).toHaveBeenCalledTimes(1);
  });

  it('swaps the active and held calls through one CallKit transaction', async () => {
    const first = lowLevelCall('signal-a', 'active');
    const second = lowLevelCall('signal-b', 'held');
    (first as any)._callKitUUID = 'callkit-a';
    (second as any)._callKitUUID = 'callkit-b';
    const secondWrapper = { callId: 'signal-b' };
    const voipClient = {
      findCallByTelnyxCall: jest.fn((call) => (call === second ? secondWrapper : null)),
      setActiveCall: jest.fn(),
    };
    coordinator.voipClient = voipClient;
    coordinator.callMap.set('callkit-a', first);
    coordinator.callMap.set('callkit-b', second);

    const swapPromise = callKitCoordinator.swapCallsFromUI(first, second);
    await Promise.resolve();

    expect(CallKit.swapCalls).toHaveBeenCalledWith('callkit-a', 'callkit-b');

    await callKitCoordinator.handleCallKitHeld('callkit-a', true);
    await callKitCoordinator.handleCallKitHeld('callkit-b', false);

    await expect(swapPromise).resolves.toBe(true);
    expect(first.hold).toHaveBeenCalledTimes(1);
    expect(second.unhold).toHaveBeenCalledTimes(1);
    expect(voipClient.setActiveCall).toHaveBeenCalledWith('signal-b');
  });

  it('resumes and selects the held survivor when the selected call ends', async () => {
    const first = lowLevelCall('signal-a', 'held');
    const second = lowLevelCall('signal-b', 'active');
    (first as any)._callKitUUID = 'callkit-a';
    (second as any)._callKitUUID = 'callkit-b';
    const firstWrapper = { callId: 'signal-a' };
    const voipClient = {
      findCallByTelnyxCall: jest.fn((call) => (call === first ? firstWrapper : null)),
      setActiveCall: jest.fn(),
    };
    coordinator.voipClient = voipClient;
    coordinator.callMap.set('callkit-a', first);
    coordinator.callMap.set('callkit-b', second);
    coordinator.selectedCallKitUUID = 'callkit-b';

    const end = coordinator.handleCallKitEnd('callkit-b');
    await flushMicrotasks();
    expect(CallKit.setCallHeld).toHaveBeenCalledWith('callkit-a', false);

    await callKitCoordinator.handleCallKitHeld('callkit-a', false);
    await end;

    expect(second.hangup).toHaveBeenCalledTimes(1);
    expect(first.unhold).toHaveBeenCalledTimes(1);
    expect(voipClient.setActiveCall).toHaveBeenCalledWith('signal-a');
  });

  it('lets the CallKit end event drive app-UI hangup and survivor restoration', async () => {
    const first = lowLevelCall('signal-a', 'held');
    const second = lowLevelCall('signal-b', 'active');
    (first as any)._callKitUUID = 'callkit-a';
    (second as any)._callKitUUID = 'callkit-b';
    coordinator.callMap.set('callkit-a', first);
    coordinator.callMap.set('callkit-b', second);
    coordinator.selectedCallKitUUID = 'callkit-b';

    await expect(callKitCoordinator.endCallFromUI(second)).resolves.toBe(true);
    expect(second.hangup).not.toHaveBeenCalled();

    const nativeEnd = coordinator.handleCallKitEnd('callkit-b');
    await flushMicrotasks();
    await callKitCoordinator.handleCallKitHeld('callkit-a', false);
    await nativeEnd;

    expect(second.hangup).toHaveBeenCalledTimes(1);
    expect(first.unhold).toHaveBeenCalledTimes(1);
    expect(first.state).toBe('active');
  });

  it('restores original states through a compensating transaction after a partial swap failure', async () => {
    const first = lowLevelCall('signal-a', 'active');
    const second = lowLevelCall('signal-b', 'held');
    (first as any)._callKitUUID = 'callkit-a';
    (second as any)._callKitUUID = 'callkit-b';
    coordinator.callMap.set('callkit-a', first);
    coordinator.callMap.set('callkit-b', second);
    (CallKit.completeHeldCallAction as jest.Mock)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    const swap = callKitCoordinator.swapCallsFromUI(first, second);
    await flushMicrotasks();
    await callKitCoordinator.handleCallKitHeld('callkit-a', true);
    await callKitCoordinator.handleCallKitHeld('callkit-b', false);
    await flushMicrotasks();

    expect(CallKit.swapCalls).toHaveBeenNthCalledWith(1, 'callkit-a', 'callkit-b');
    expect(CallKit.swapCalls).toHaveBeenNthCalledWith(2, 'callkit-b', 'callkit-a');
    expect(first.state).toBe('active');
    expect(second.state).toBe('held');

    await callKitCoordinator.handleCallKitHeld('callkit-b', true);
    await callKitCoordinator.handleCallKitHeld('callkit-a', false);

    await expect(swap).resolves.toBe(false);
    expect(first.state).toBe('active');
    expect(second.state).toBe('held');
  });

  it('blocks another swap while compensating WebRTC state is being restored', async () => {
    const first = lowLevelCall('signal-a', 'active');
    const second = lowLevelCall('signal-b', 'held');
    (first as any)._callKitUUID = 'callkit-a';
    (second as any)._callKitUUID = 'callkit-b';
    coordinator.callMap.set('callkit-a', first);
    coordinator.callMap.set('callkit-b', second);

    let finishRestoration!: () => void;
    const restoration = new Promise<void>((resolve) => {
      finishRestoration = resolve;
    });
    jest.spyOn(coordinator, 'restoreOriginalWebRTCStates').mockImplementation(() => restoration);

    const originalSwap = callKitCoordinator.swapCallsFromUI(first, second);
    await flushMicrotasks();
    const pendingSwap = coordinator.pendingSwap;
    const rollback = coordinator.beginSwapRollback(pendingSwap);
    await flushMicrotasks();

    await expect(callKitCoordinator.swapCallsFromUI(first, second)).resolves.toBe(false);
    expect(CallKit.swapCalls).toHaveBeenCalledTimes(1);

    finishRestoration();
    await rollback;
    expect(CallKit.swapCalls).toHaveBeenCalledTimes(2);

    coordinator.finishPendingSwap(false);
    await expect(originalSwap).resolves.toBe(false);
  });

  it('processes a pushed UUID once across native event and app-resume delivery', async () => {
    (VoicePnBridge.getPendingVoipPush as jest.Mock).mockResolvedValue(
      JSON.stringify({
        payload: { metadata: { call_id: 'callkit-b', voice_sdk_id: 'voice-sdk-b' } },
      })
    );
    const voipClient = {
      setPushNotificationCallKitUUID: jest.fn(),
      queueAnswerFromCallKit: jest.fn(),
      handlePushNotification: jest.fn().mockResolvedValue(undefined),
    };
    coordinator.voipClient = voipClient;

    await callKitCoordinator.handleCallKitPushReceived('CALLKIT-B');
    await callKitCoordinator.handleCallKitPushReceived('callkit-b');

    expect(voipClient.handlePushNotification).toHaveBeenCalledTimes(1);
    expect(voipClient.setPushNotificationCallKitUUID).toHaveBeenCalledWith('callkit-b');
  });

  it('suppresses persisted push processing when CallKit rejected its UUID', async () => {
    (CallKit.isCallRegistered as jest.Mock).mockResolvedValue(false);
    (VoicePnBridge.getPendingVoipPush as jest.Mock).mockResolvedValue(
      JSON.stringify({
        payload: { metadata: { call_id: 'callkit-focus', voice_sdk_id: 'voice-sdk-focus' } },
      })
    );
    const voipClient = {
      queueEndFromCallKit: jest.fn(),
      handlePushNotification: jest.fn().mockResolvedValue(undefined),
    };
    coordinator.voipClient = voipClient;

    await callKitCoordinator.handleCallKitPushReceived('CALLKIT-FOCUS');

    expect(voipClient.queueEndFromCallKit).toHaveBeenCalledWith('callkit-focus');
    expect(voipClient.handlePushNotification).not.toHaveBeenCalled();
    expect(VoicePnBridge.clearPendingVoipPush).toHaveBeenCalledTimes(1);
  });

  it('uses only the UUID-keyed pending answer path for a cold CallKit answer', async () => {
    (VoicePnBridge.getPendingVoipPush as jest.Mock).mockResolvedValue(
      JSON.stringify({
        payload: { metadata: { call_id: 'callkit-b', voice_sdk_id: 'voice-sdk-b' } },
      })
    );
    const voipClient = {
      setPushNotificationCallKitUUID: jest.fn(),
      queueAnswerFromCallKit: jest.fn(),
      handlePushNotification: jest.fn().mockResolvedValue(undefined),
    };
    coordinator.voipClient = voipClient;
    coordinator.autoAnswerCallUUIDs.add('callkit-b');

    await callKitCoordinator.handleCallKitPushReceived('callkit-b');

    expect(voipClient.queueAnswerFromCallKit).toHaveBeenCalledWith('callkit-b');
    expect(voipClient.handlePushNotification).toHaveBeenCalledWith({
      metadata: expect.objectContaining({
        call_id: 'callkit-b',
        from_callkit: true,
      }),
    });
    expect(voipClient.handlePushNotification.mock.calls[0][0]).not.toHaveProperty(
      'from_notification'
    );
    expect(voipClient.handlePushNotification.mock.calls[0][0]).not.toHaveProperty('action');
  });

  it('processes the persisted push immediately when CallKit is answered before its INVITE', async () => {
    (VoicePnBridge.clearPendingVoipPush as jest.Mock).mockClear();
    (VoicePnBridge.getPendingVoipPush as jest.Mock).mockResolvedValue(
      JSON.stringify({
        payload: { metadata: { call_id: 'callkit-b', voice_sdk_id: 'voice-sdk-b' } },
      })
    );
    const voipClient = {
      setPushNotificationCallKitUUID: jest.fn(),
      queueAnswerFromCallKit: jest.fn(),
      handlePushNotification: jest.fn().mockResolvedValue(undefined),
    };
    coordinator.voipClient = voipClient;

    await coordinator.handlePushNotificationAnswer('callkit-b');

    expect(voipClient.queueAnswerFromCallKit).toHaveBeenCalledWith('callkit-b');
    expect(voipClient.handlePushNotification).toHaveBeenCalledTimes(1);
    expect(VoicePnBridge.clearPendingVoipPush).not.toHaveBeenCalled();
  });

  it('returns false when CallKit registration is rejected', async () => {
    (CallKit.isCallRegistered as jest.Mock).mockResolvedValue(false);
    (VoicePnBridge.getPendingVoipPush as jest.Mock).mockResolvedValue(
      JSON.stringify({
        payload: { metadata: { call_id: 'callkit-rejected', voice_sdk_id: 'voice-sdk-r' } },
      })
    );
    const voipClient = {
      queueEndFromCallKit: jest.fn(),
      handlePushNotification: jest.fn().mockResolvedValue(undefined),
    };
    coordinator.voipClient = voipClient;

    const result = await callKitCoordinator.handleCallKitPushReceived('CALLKIT-REJECTED');

    expect(result).toBe(false);
    expect(voipClient.handlePushNotification).not.toHaveBeenCalled();
  });

  it('returns false for a duplicate push UUID', async () => {
    coordinator.pendingPushCallUUIDs.add('callkit-dup');

    const result = await callKitCoordinator.handleCallKitPushReceived('callkit-dup');

    expect(result).toBe(false);
  });

  it('returns true when push notification is processed successfully', async () => {
    (VoicePnBridge.getPendingVoipPush as jest.Mock).mockResolvedValue(
      JSON.stringify({
        payload: { metadata: { call_id: 'callkit-ok', voice_sdk_id: 'voice-sdk-ok' } },
      })
    );
    const voipClient = {
      setPushNotificationCallKitUUID: jest.fn(),
      queueAnswerFromCallKit: jest.fn(),
      handlePushNotification: jest.fn().mockResolvedValue(undefined),
    };
    coordinator.voipClient = voipClient;

    const result = await callKitCoordinator.handleCallKitPushReceived('callkit-ok');

    expect(result).toBe(true);
    expect(voipClient.handlePushNotification).toHaveBeenCalledTimes(1);
  });

  it('completes the pending CallKit answer action when the call is already active', async () => {
    const call = lowLevelCall('signal-active', 'active');
    (call as any)._callKitUUID = 'callkit-active';
    coordinator.callMap.set('callkit-active', call);
    coordinator.connectedCalls.clear();

    await callKitCoordinator.handleCallKitAnswer('callkit-active');

    // Should not attempt to answer again
    expect(call.answer).not.toHaveBeenCalled();
    // Should report connected to fulfill the pending CXAnswerCallAction
    expect(CallKit.reportCallConnected).toHaveBeenCalledWith('callkit-active');
    // Should mark the call as connected to avoid duplicate reports
    expect(coordinator.connectedCalls.has('callkit-active')).toBe(true);
  });

  it('does not double-report connected when already-active call was previously connected', async () => {
    const call = lowLevelCall('signal-active', 'active');
    (call as any)._callKitUUID = 'callkit-active';
    coordinator.callMap.set('callkit-active', call);
    coordinator.connectedCalls.add('callkit-active');

    await callKitCoordinator.handleCallKitAnswer('callkit-active');

    expect(call.answer).not.toHaveBeenCalled();
    expect(CallKit.reportCallConnected).not.toHaveBeenCalled();
  });
});
