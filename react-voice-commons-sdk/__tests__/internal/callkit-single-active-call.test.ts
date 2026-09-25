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
  },
}));

jest.mock('../../src/callkit/callkit', () => ({
  __esModule: true,
  default: {
    isAvailable: jest.fn(() => false),
    reportCallEnded: jest.fn().mockResolvedValue(true),
    reportCallConnected: jest.fn().mockResolvedValue(true),
  },
  CallEndReason: { Failed: 1 },
}));

import CallKit from '../../src/callkit/callkit';
import { callKitCoordinator } from '../../src/callkit/callkit-coordinator';

describe('CallKitCoordinator single-active-call policy', () => {
  afterEach(() => {
    jest.clearAllMocks();
    callKitCoordinator.releaseActiveCallForTesting('call-1');
    callKitCoordinator.releaseActiveCallForTesting('call-2');
  });

  it('allows duplicate ownership for the same call but rejects another call', () => {
    expect(callKitCoordinator.claimActiveCallForTesting('call-1')).toBe(true);
    expect(callKitCoordinator.claimActiveCallForTesting('call-1')).toBe(true);
    expect(callKitCoordinator.claimActiveCallForTesting('call-2')).toBe(false);
  });

  it('allows the next call after the owner is released', () => {
    expect(callKitCoordinator.claimActiveCallForTesting('call-1')).toBe(true);
    callKitCoordinator.releaseActiveCallForTesting('call-1');
    expect(callKitCoordinator.claimActiveCallForTesting('call-2')).toBe(true);
  });

  it('hangs up and removes a mapped call rejected by the active-call gate', async () => {
    const rejectedCall = {
      callId: 'call-2',
      hangup: jest.fn().mockResolvedValue(undefined),
    } as any;

    callKitCoordinator.claimActiveCallForTesting('call-1');
    (callKitCoordinator as any).callMap.set('call-2', rejectedCall);

    await callKitCoordinator.handleCallKitAnswer('call-2');

    expect(CallKit.reportCallEnded).toHaveBeenCalledWith('call-2', 1);
    expect(rejectedCall.hangup).toHaveBeenCalledTimes(1);
    expect(callKitCoordinator.getWebRTCCall('call-2')).toBeNull();
  });

  it('rejects an active outgoing call when another call owns the slot', async () => {
    const outgoingCall = {
      callId: 'call-2',
      hangup: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      removeListener: jest.fn(),
    } as any;

    callKitCoordinator.claimActiveCallForTesting('call-1');
    (callKitCoordinator as any).callMap.set('call-2', outgoingCall);
    (callKitCoordinator as any).setupWebRTCCallListeners(outgoingCall, 'call-2');
    const stateListener = outgoingCall.on.mock.calls[0][1];

    await stateListener(outgoingCall, 'active');

    expect(CallKit.reportCallEnded).toHaveBeenCalledWith('call-2', 1);
    expect(outgoingCall.hangup).toHaveBeenCalledTimes(1);
    expect(callKitCoordinator.getWebRTCCall('call-2')).toBeNull();
  });

  it('releases a push-answer claim when no VoIP client can queue the answer', async () => {
    (callKitCoordinator as any).voipClient = null;

    await callKitCoordinator.handleCallKitAnswer('call-1');

    expect(callKitCoordinator.claimActiveCallForTesting('call-2')).toBe(true);
  });
});
