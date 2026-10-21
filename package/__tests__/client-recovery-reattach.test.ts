import { TelnyxRTC } from '../lib/client';
import { Call } from '../lib/call';
import type { CallReportPayload, CallReportSummary } from '../lib/call-report-models';
import type { Connection } from '../lib/connection';

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
    reportRecoveryReattachOutcome: jest.fn(),
    cancelRecovery: jest.fn(),
    checkSignalingHealth: jest.fn(),
  };
}

const REPORT_CONFIG = {
  enableCallReports: true,
  callReportInterval: 5,
  callReportLogLevel: 'debug',
  callReportMaxLogEntries: 1000,
};

function createReportingCall(client: TelnyxRTC, callId: string) {
  const connection: any = {
    addListener: jest.fn(),
    isConnected: true,
    inboundIdleMs: 0,
    confirmedOutboundIdleMs: 0,
    host: 'rtc.telnyx.com',
  };
  const call = new Call({
    connection: connection as Connection,
    options: { destinationNumber: '+155****4567' },
    sessionId: 'session-id',
    direction: 'inbound',
    callId,
    telnyxLegId: 'telnyx-leg-id',
    telnyxSessionId: 'telnyx-session-id',
    callState: 'active',
    callReportConfig: REPORT_CONFIG,
    recoveryHooks: (client as any).buildRecoveryHooks(),
  });
  const peer = { close: jest.fn() };
  (call as any).peer = peer;
  client.calls.set(callId, call);

  const summary: CallReportSummary = {
    callId,
    direction: 'INCOMING',
    state: 'active',
    durationSeconds: null,
    sdkVersion: '1.1.0',
    startTimestamp: '2026-10-20T00:00:00.000Z',
    endTimestamp: null,
  };
  const payload = (): CallReportPayload => (call as any).callReportCollector.buildPayload(summary);

  return { call, monitor: (call as any).signalingHealthMonitor, payload, peer };
}

async function flushPromises() {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
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
    expect(callA.reportRecoveryReattachOutcome).toHaveBeenCalledWith(true);
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
    expect(callA.reportRecoveryReattachOutcome).toHaveBeenCalledWith(false);
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
    expect(call.checkSignalingHealth).toHaveBeenCalledTimes(1);

    // Explicit disconnect: the connection object is gone but the call is
    // still tracked as active. The monitor must stop — recovery must not
    // restart a session the consumer deliberately closed.
    (client as any).connection = null;
    jest.advanceTimersByTime((TelnyxRTC as any).ACTIVE_CALL_HEALTH_CHECK_MS * 3);
    expect(call.checkSignalingHealth).toHaveBeenCalledTimes(1);
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

  it('explicit disconnect during reattach prevents late call attachment without recovery-failed error', async () => {
    const call = createMockCall('call-a');
    client.calls.set('call-a', call as any);
    const failSpy = jest.spyOn(client as any, 'failRecoveryReattach');
    let resolveConnect: () => void = () => {};
    connectSpy.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveConnect = resolve;
      })
    );

    const fallback = (client as any).performReattachFallbackForRecovery('call-a');
    await Promise.resolve();
    await Promise.resolve();
    expect(connectSpy).toHaveBeenCalledTimes(1);

    (client as any).connection = { close: jest.fn(), isConnected: true };
    (TelnyxRTC.prototype as any).disconnect.call(client, false);
    client.emit('telnyx.call.reattached', call as any, {} as any);
    resolveConnect();

    await expect(fallback).resolves.toBe(false);
    expect(failSpy).not.toHaveBeenCalled();
    expect(call.reportRecoveryReattachOutcome).not.toHaveBeenCalled();
    expect(call.setDropped).not.toHaveBeenCalled();
  });

  it('internal recovery disconnect(true) still permits the intended reconnect', async () => {
    const call = createMockCall('call-a');
    client.calls.set('call-a', call as any);
    (client as any).connection = { close: jest.fn(), isConnected: true };

    (TelnyxRTC.prototype as any).disconnect.call(client, true);
    expect((client as any).explicitDisconnectRequested).toBe(false);

    const fallback = (client as any).performReattachFallbackForRecovery('call-a');
    await Promise.resolve();
    await Promise.resolve();
    client.emit('telnyx.call.reattached', call as any, {} as any);

    await expect(fallback).resolves.toBe(true);
    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  it('reports successful reattach from the original Call after its monitor is cancelled', async () => {
    const { monitor, payload, peer } = createReportingCall(client, 'call-a');

    const recovery = (monitor as any).performFallback('integration-test');
    await flushPromises();
    expect(peer.close).toHaveBeenCalledTimes(1);

    client.emit('telnyx.call.reattached', { callId: 'call-a' } as any, {} as any);
    await recovery;

    const messages = payload().logs.map((entry) => entry.message);
    expect(messages).toContain('Recovery reattach succeeded');
    expect(messages).not.toContain('Recovery failed after one reattach attempt');
  });

  it('reports reattach timeout from the original Call after its monitor is cancelled', async () => {
    const { monitor, payload } = createReportingCall(client, 'call-a');

    const recovery = (monitor as any).performFallback('integration-test');
    await flushPromises();
    jest.advanceTimersByTime((TelnyxRTC as any).RECONNECT_TIMEOUT);
    await flushPromises();
    await recovery;

    const messages = payload().logs.map((entry) => entry.message);
    expect(messages).toContain('Recovery failed after one reattach attempt');
    expect(messages).not.toContain('Recovery reattach succeeded');
  });

  it('does not report a reattach failure after explicit user cancellation', async () => {
    const { monitor, payload } = createReportingCall(client, 'call-a');

    const recovery = (monitor as any).performFallback('integration-test');
    await flushPromises();
    (TelnyxRTC.prototype as any).disconnect.call(client, false);
    client.emit('telnyx.call.reattached', { callId: 'call-a' } as any, {} as any);
    jest.advanceTimersByTime((TelnyxRTC as any).RECONNECT_TIMEOUT);
    await flushPromises();
    await recovery;

    const messages = payload().logs.map((entry) => entry.message);
    expect(messages).not.toContain('Recovery failed after one reattach attempt');
    expect(messages).not.toContain('Recovery reattach succeeded');
  });
});
