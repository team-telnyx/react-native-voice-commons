import { TelnyxRTC } from '../lib/client';

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

function createMockCall(callId: string, state: string = 'active') {
  return {
    callId,
    state,
    direction: 'inbound',
    on: jest.fn(),
    off: jest.fn(),
    hangup: jest.fn(),
    answer: jest.fn(),
    setDropped: jest.fn(),
    disposePeer: jest.fn(),
  };
}

describe('Recovery reattach fallback (VSDK-679 review fixes)', () => {
  let client: TelnyxRTC;
  let connectSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    client = new TelnyxRTC({ logLevel: 'debug' });
    // Isolate the fallback from the real connect/disconnect flow: the
    // reattach event and the window expiry drive the outcome.
    connectSpy = jest.spyOn(client as any, 'connect').mockResolvedValue(undefined);
    jest.spyOn(client as any, 'disconnect').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('settles only when the reattached call matches the recovering call id', async () => {
    const callA = createMockCall('call-a');
    const callB = createMockCall('call-b');
    client.calls.set('call-a', callA as any);
    client.calls.set('call-b', callB as any);

    let settledValue: boolean | null = null;
    const fallback = (client as any)
      .performReattachFallbackForRecovery('call-a')
      .then((value: boolean) => {
        settledValue = value;
        return value;
      });

    await Promise.resolve();
    await Promise.resolve();

    // An attach for another call must not settle this fallback.
    client.emit('telnyx.call.reattached', callB as any, {} as any);
    await Promise.resolve();
    expect(settledValue).toBeNull();

    // The recovering call's own replacement attach settles it as recovered.
    client.emit('telnyx.call.reattached', callA as any, {} as any);
    const value = await fallback;
    expect(value).toBe(true);
    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  it('disposes tracked peers and detaches stale state listeners before the reconnect', async () => {
    const callA = createMockCall('call-a');
    const stateListener = jest.fn();
    client.calls.set('call-a', callA as any);
    (client as any).callStateListeners.set('call-a', stateListener);

    const fallback = (client as any).performReattachFallbackForRecovery('call-a');

    await Promise.resolve();
    await Promise.resolve();

    // Old peer torn down (mic tracks stopped) and stale state listener
    // detached, mirroring onNetworkUnavailable's teardown.
    expect(callA.disposePeer).toHaveBeenCalledTimes(1);
    expect(callA.off).toHaveBeenCalledWith('telnyx.call.state', stateListener);
    expect((client as any).callStateListeners.has('call-a')).toBe(false);

    // The fallback fails closed when no matching attach arrives.
    jest.advanceTimersByTime((TelnyxRTC as any).RECONNECT_TIMEOUT);
    await Promise.resolve();
    await Promise.resolve();
    await expect(fallback).resolves.toBe(false);
  });
});
