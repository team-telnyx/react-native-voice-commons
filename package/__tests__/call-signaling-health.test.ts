import { Call } from '../lib/call';
import type { Connection } from '../lib/connection';
import { TelnyxRTCMethod } from '../lib/messages/methods';

/** Drain pending microtasks. */
async function flush(): Promise<void> {
  for (let i = 0; i < 12; i += 1) {
    await Promise.resolve();
  }
}

function buildCall(debug = false) {
  const connection: any = {
    addListener: jest.fn(),
    send: jest.fn(),
    sendAndWait: jest.fn().mockResolvedValue({ jsonrpc: '2.0', result: {} }),
    isConnected: true,
    idleMs: Infinity,
    inboundIdleMs: Infinity,
    confirmedOutboundIdleMs: Infinity,
  };
  const recoveryHooks = {
    isClientReconnecting: jest.fn().mockReturnValue(false),
    performReattachFallback: jest.fn().mockResolvedValue(false),
  };

  const call = new Call({
    connection: connection as Connection,
    options: { destinationNumber: '+155****4567' },
    sessionId: 'session-id',
    direction: 'inbound',
    telnyxSessionId: 'telnyx-session-id',
    telnyxLegId: 'telnyx-leg-id',
    callId: 'signaling-call-id',
    callState: 'active',
    debug,
    recoveryHooks,
  });

  const monitor = (call as any).signalingHealthMonitor;
  const probesSent = () =>
    connection.sendAndWait.mock.calls.filter(
      ([msg]: [{ method?: string }]) => msg?.method === TelnyxRTCMethod.PING
    ).length;
  return { call, connection, monitor, recoveryHooks, probesSent };
}

describe('Call signaling health checks (SignalingHealthMonitor wiring)', () => {
  it('feeds connection liveness into the signaling health monitor', () => {
    const { connection, monitor } = buildCall();
    connection.inboundIdleMs = 2;
    connection.confirmedOutboundIdleMs = 10_000;

    expect(monitor.deps.isSignalingAvailable()).toBe(true);
    expect(monitor.deps.inboundSignalingIdleMs()).toBe(2);
    expect(monitor.deps.confirmedOutboundIdleMs()).toBe(10_000);

    connection.isConnected = false;
    expect(monitor.deps.isSignalingAvailable()).toBe(false);
  });

  it('probes with a correlated ping when the link has no confirmed traffic', async () => {
    const { call, probesSent } = buildCall();

    call.checkSignalingHealth();
    await flush();

    expect(probesSent()).toBe(1);
  });

  it('does not let a one-way outbound send mask a dead link in the periodic check', async () => {
    const { call, connection, probesSent } = buildCall();

    // Total idle looks fresh (one-way send), but nothing inbound and no
    // confirmed request/response were ever observed.
    connection.idleMs = 1;
    connection.inboundIdleMs = Infinity;
    connection.confirmedOutboundIdleMs = Infinity;

    call.checkSignalingHealth();
    await flush();

    expect(probesSent()).toBe(1);
  });

  it('does not probe a healthy quiet call until iOS staleness thresholds are reached', async () => {
    const { call, connection, probesSent } = buildCall();
    connection.inboundIdleMs = 19_999;
    connection.confirmedOutboundIdleMs = 44_999;

    call.checkSignalingHealth();
    await flush();

    expect(probesSent()).toBe(0);
  });

  it('stays silent when the link has confirmed recent traffic', async () => {
    const { call, connection, probesSent } = buildCall();
    connection.inboundIdleMs = 10;
    connection.confirmedOutboundIdleMs = 10;

    call.checkSignalingHealth();
    await flush();

    expect(probesSent()).toBe(0);
  });

  it('ignores the periodic check for non-active calls', async () => {
    const { call, probesSent } = buildCall();
    (call as any).state = 'ended';

    call.checkSignalingHealth();
    await flush();

    expect(probesSent()).toBe(0);
  });

  it('treats a correlated JSON-RPC error reply as live signaling (iOS parity)', async () => {
    const { call, connection, monitor, recoveryHooks, probesSent } = buildCall();
    connection.sendAndWait.mockResolvedValue({
      jsonrpc: '2.0',
      error: { code: -32601, message: 'Method not found' },
    });

    call.checkSignalingHealth();
    await flush();

    expect(probesSent()).toBe(1);
    expect(recoveryHooks.performReattachFallback).not.toHaveBeenCalled();
    expect(monitor.state).toBe('idle');
  });

  it('reattaches without a probe when the socket is disconnected', async () => {
    const { call, connection, recoveryHooks, probesSent } = buildCall();
    connection.isConnected = false;

    call.checkSignalingHealth();
    await flush();

    expect(probesSent()).toBe(0);
    expect(recoveryHooks.performReattachFallback).toHaveBeenCalledWith('signaling-call-id');
  });

  it('reattaches when the probe cannot be sent', async () => {
    const { call, connection, recoveryHooks } = buildCall();
    connection.sendAndWait.mockRejectedValue(new Error('Connection closed'));

    call.checkSignalingHealth();
    await flush();

    expect(recoveryHooks.performReattachFallback).toHaveBeenCalledTimes(1);
  });

  it('forwards a manual ICE failure when debug mode is enabled', () => {
    const { call, monitor } = buildCall(true);
    const simulate = jest.spyOn(monitor, 'simulateIceFailureForTesting').mockReturnValue(true);

    expect(call.simulateIceFailureForTesting()).toBe(true);
    expect(simulate).toHaveBeenCalledTimes(1);
  });

  it('rejects a manual ICE failure when debug mode is disabled', () => {
    const { call, monitor } = buildCall();
    const simulate = jest.spyOn(monitor, 'simulateIceFailureForTesting');

    expect(call.simulateIceFailureForTesting()).toBe(false);
    expect(simulate).not.toHaveBeenCalled();
  });
});
