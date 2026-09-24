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
  VoicePnBridge: {},
}));

jest.mock('../../src/callkit/callkit', () => ({
  __esModule: true,
  default: { isAvailable: jest.fn(() => false) },
  CallEndReason: { Failed: 1 },
}));

import { callKitCoordinator } from '../../src/callkit/callkit-coordinator';

describe('CallKitCoordinator single-active-call policy', () => {
  afterEach(() => {
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
});
