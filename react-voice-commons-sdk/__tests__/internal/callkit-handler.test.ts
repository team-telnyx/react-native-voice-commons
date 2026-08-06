const mockListeners = new Map<string, (event: any) => Promise<void>>();
const mockRefs: Array<{ current: any }> = [];
const mockRemoveAllListeners = jest.fn();
let mockHookIndex = 0;
let mockSetupEffect: (() => (() => void) | void) | undefined;

jest.mock('react', () => ({
  __esModule: true,
  default: {},
  useRef: jest.fn((initialValue) => {
    const ref = mockRefs[mockHookIndex] ?? { current: initialValue };
    mockRefs[mockHookIndex] = ref;
    mockHookIndex += 1;
    return ref;
  }),
  useEffect: jest.fn((effect, dependencies) => {
    if (Array.isArray(dependencies) && dependencies.length === 0 && !mockSetupEffect) {
      mockSetupEffect = effect;
    }
  }),
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  DeviceEventEmitter: {
    addListener: jest.fn((eventName, listener) => {
      mockListeners.set(eventName, listener);
      return { remove: jest.fn(() => mockListeners.delete(eventName)) };
    }),
    removeAllListeners: mockRemoveAllListeners,
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

import { CallKitHandler } from '../../src/internal/CallKitHandler';

describe('CallKitHandler callbacks', () => {
  afterEach(() => {
    mockListeners.clear();
    mockRefs.length = 0;
    mockHookIndex = 0;
    mockSetupEffect = undefined;
    jest.clearAllMocks();
  });

  it('uses the latest callbacks after a rerender without replacing listeners', async () => {
    const initialLogin = jest.fn();
    const initialDialer = jest.fn();
    const initialBack = jest.fn();
    const latestLogin = jest.fn();
    const latestDialer = jest.fn();
    const latestBack = jest.fn();

    mockHookIndex = 0;
    CallKitHandler({
      onLoginRequired: initialLogin,
      onNavigateToDialer: initialDialer,
      onNavigateBack: initialBack,
    });
    const cleanup = mockSetupEffect?.();

    expect(mockRemoveAllListeners).not.toHaveBeenCalled();

    mockHookIndex = 0;
    CallKitHandler({
      onLoginRequired: latestLogin,
      onNavigateToDialer: latestDialer,
      onNavigateBack: latestBack,
    });

    await mockListeners.get('incomingVoIPCall')?.({
      action: 'connect_webrtc',
      callUUID: 'call-1',
      payload: { call_id: 'call-1' },
    });
    await mockListeners.get('callKitAction')?.({ action: 'answer', callUUID: 'call-1' });
    await mockListeners.get('callKitAction')?.({ action: 'end', callUUID: 'call-1' });

    expect(initialLogin).not.toHaveBeenCalled();
    expect(initialDialer).not.toHaveBeenCalled();
    expect(initialBack).not.toHaveBeenCalled();
    expect(latestLogin).toHaveBeenCalledWith({ call_id: 'call-1' });
    expect(latestDialer).toHaveBeenCalledTimes(1);
    expect(latestBack).toHaveBeenCalledTimes(1);

    cleanup?.();
  });
});
