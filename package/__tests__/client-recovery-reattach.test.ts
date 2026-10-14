import { TelnyxRTC } from '../lib/client';
import { Call } from '../lib/call';

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
    setDropped: jest.fn(function (this: any) {
      this.state = 'dropped';
    }),
    disposePeer: jest.fn(),
    cancelRecovery: jest.fn(),
    checkSignalingHealthForRecovery: jest.fn(),
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

    const clientError = jest.fn();
    client.on('telnyx.client.error', clientError);

    // The fallback fails closed when no matching attach arrives.
    jest.advanceTimersByTime((TelnyxRTC as any).RECONNECT_TIMEOUT);
    await Promise.resolve();
    await Promise.resolve();
    await expect(fallback).resolves.toBe(false);
    expect(callA.setDropped).toHaveBeenCalledTimes(1);
    expect(client.calls.has('call-a')).toBe(false);
    expect(clientError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('does not emit reattached when answerAttach fails', async () => {
    const answerError = new Error('answer attach failed');
    const attachedCall = createMockCall('call-a', 'connecting');
    (attachedCall as any).answerAttach = jest.fn().mockRejectedValue(answerError);
    const createSpy = jest.spyOn(Call, 'createInboundCall').mockResolvedValue(attachedCall as any);
    (client as any).connection = {};
    (client as any).sessionId = 'session-id';
    const reattached = jest.fn();
    const clientError = jest.fn();
    client.on('telnyx.call.reattached', reattached);
    client.on('telnyx.client.error', clientError);

    await (client as any).handleCallAttach({
      params: {
        callID: 'call-a',
        sdp: 'remote-sdp',
        caller_id_number: '+15551234567',
        dialogParams: {},
      },
    });

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(attachedCall.answerAttach).toHaveBeenCalledTimes(1);
    expect(attachedCall.disposePeer).toHaveBeenCalledTimes(1);
    expect(reattached).not.toHaveBeenCalled();
    expect(client.calls.has('call-a')).toBe(false);
    expect(clientError).toHaveBeenCalledWith(answerError);
  });

  it('stops the signaling monitor after an explicit disconnect (no post-disconnect recovery)', () => {
    const call = createMockCall('call-a');
    (client as any).addCall(call);

    // Sanity: while a connection exists the monitor ticks and forwards to the
    // active call's signaling health check.
    (client as any).connection = {
      isConnected: true,
      inboundIdleMs: Infinity,
      confirmedOutboundIdleMs: Infinity,
    };
    jest.advanceTimersByTime((TelnyxRTC as any).ACTIVE_CALL_HEALTH_CHECK_MS);
    expect(call.checkSignalingHealthForRecovery).toHaveBeenCalledTimes(1);

    // Explicit disconnect: the connection object is gone but the call is
    // still tracked as active. The monitor must stop — recovery must not
    // restart a session the consumer deliberately closed.
    (client as any).connection = null;
    jest.advanceTimersByTime((TelnyxRTC as any).ACTIVE_CALL_HEALTH_CHECK_MS * 3);
    expect(call.checkSignalingHealthForRecovery).toHaveBeenCalledTimes(1);
    expect((client as any).activeCallHealthCheckHandle).toBeNull();
  });

  it('explicit disconnect cancels active call recovery and blocks stale reattach fallback', async () => {
    const call = createMockCall('call-a');
    client.calls.set('call-a', call as any);
    (client as any).connection = { close: jest.fn(), isConnected: true };

    (TelnyxRTC.prototype as any).disconnect.call(client, false);

    expect(call.cancelRecovery).toHaveBeenCalledWith('client-disconnect');
    expect((client as any).activeCallHealthCheckHandle).toBeNull();
    await expect((client as any).performReattachFallbackForRecovery('call-a')).resolves.toBe(false);
    expect(connectSpy).not.toHaveBeenCalled();
  });
});
