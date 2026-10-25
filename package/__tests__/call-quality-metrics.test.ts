import { Call } from '../lib/call';
import type { Connection } from '../lib/connection';

jest.mock('loglevel', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

async function flush(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await Promise.resolve();
  }
}

function buildCall(options: { debug?: boolean; enableQualityMetrics?: boolean } = {}) {
  const connection: any = {
    addListener: jest.fn(),
    send: jest.fn(),
    sendAndWait: jest.fn(),
    isConnected: true,
    inboundIdleMs: 0,
    confirmedOutboundIdleMs: 0,
  };
  const peerConnection = {
    getStats: jest.fn().mockResolvedValue({ forEach: () => {}, get: () => undefined }),
  };

  const call = new Call({
    connection: connection as Connection,
    options: { destinationNumber: '+155****4567' },
    sessionId: 'session-id',
    direction: 'inbound',
    telnyxSessionId: 'telnyx-session-id',
    telnyxLegId: 'telnyx-leg-id',
    callId: 'quality-call-id',
    callState: 'connecting',
    debug: options.debug,
    enableQualityMetrics: options.enableQualityMetrics,
  });
  (call as any).peer = { getPeerConnection: () => peerConnection, close: jest.fn() };
  // Keep the call report collector out of these tests.
  (call as any).startCallReportCollector = jest.fn();

  return { call, peerConnection };
}

describe('Call quality metrics', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not collect by default (opt-in, like iOS)', () => {
    const { call, peerConnection } = buildCall();

    (call as any).setState('active');

    expect(call.isQualityMetricsActive()).toBe(false);
    expect(peerConnection.getStats).not.toHaveBeenCalled();
  });

  it.each([
    ['enableQualityMetrics', { enableQualityMetrics: true }],
    ['debug', { debug: true }],
  ])('starts automatically when the call becomes active with %s', (_label, options) => {
    const { call } = buildCall(options);

    (call as any).setState('active');

    expect(call.isQualityMetricsActive()).toBe(true);
    call.stopQualityMetrics();
  });

  it('delivers snapshots to the callback and the telnyx.call.qualityMetrics event', async () => {
    const { call } = buildCall({ enableQualityMetrics: true });
    const callback = jest.fn();
    const listener = jest.fn();
    call.onQualityMetrics = callback;
    call.on('telnyx.call.qualityMetrics', listener);

    (call as any).setState('active');
    await flush();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(callback.mock.calls[0][0]);
    expect(call.getQualityMetrics()).toBe(callback.mock.calls[0][0]);
    call.stopQualityMetrics();
  });

  it('stops collecting when the peer is disposed (reattach replaces the peer)', async () => {
    const { call, peerConnection } = buildCall({ enableQualityMetrics: true });
    (call as any).setState('active');
    await flush();
    expect(peerConnection.getStats).toHaveBeenCalledTimes(1);

    call.disposePeer();
    jest.advanceTimersByTime(5000);
    await flush();

    expect(call.isQualityMetricsActive()).toBe(false);
    expect(peerConnection.getStats).toHaveBeenCalledTimes(1);
  });

  it.each(['ended', 'dropped'])('stops collecting when the call is %s', (state) => {
    const { call } = buildCall({ enableQualityMetrics: true });
    (call as any).stopAndPostCallReport = jest.fn().mockResolvedValue(undefined);
    (call as any).setState('active');

    (call as any).setState(state);

    expect(call.isQualityMetricsActive()).toBe(false);
  });
});
