import { Call } from '../lib/call';
import type { Connection } from '../lib/connection';

function buildCall(debug = false) {
  const connection: any = {
    addListener: jest.fn(),
    send: jest.fn(),
    sendAndWait: jest.fn(),
    isConnected: true,
    idleMs: Infinity,
    inboundIdleMs: Infinity,
    confirmedOutboundIdleMs: Infinity,
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
  });

  const coordinator = (call as any).recoveryCoordinator;
  return { call, connection, coordinator };
}

describe('Call signaling health checks (ICE restart recovery)', () => {
  it('treats a confirmed request/response exchange as fresh signaling for media recovery', () => {
    const { connection, coordinator } = buildCall();
    connection.inboundIdleMs = 2;
    connection.confirmedOutboundIdleMs = 10_000;

    const isSignalingFresh = coordinator.deps.isSignalingFresh;
    expect(isSignalingFresh()).toBe(true);
  });

  it('does not let one-way outbound sends mask a dead link', () => {
    const { connection, coordinator } = buildCall();

    // Only a client-initiated send happened (total idle is fresh), but no
    // inbound message and no confirmed outbound response were ever observed.
    connection.idleMs = 1;
    connection.inboundIdleMs = Infinity;
    connection.confirmedOutboundIdleMs = Infinity;

    const isSignalingFresh = coordinator.deps.isSignalingFresh;
    expect(isSignalingFresh()).toBe(false);
  });

  it('treats media recovery signaling as stale when recent inbound is missing', () => {
    const { connection, coordinator } = buildCall();
    connection.inboundIdleMs = 4_000;
    connection.confirmedOutboundIdleMs = 10_000;

    const isSignalingFresh = coordinator.deps.isSignalingFresh;
    expect(isSignalingFresh()).toBe(false);
  });

  it('reports stale signaling when the socket is disconnected', () => {
    const { connection, coordinator } = buildCall();
    connection.inboundIdleMs = 1;
    connection.confirmedOutboundIdleMs = 1;
    connection.isConnected = false;

    const isSignalingFresh = coordinator.deps.isSignalingFresh;
    expect(isSignalingFresh()).toBe(false);
  });

  it('notifies the recovery coordinator when the link has no confirmed traffic', () => {
    const { call, coordinator } = buildCall();
    const notify = jest.spyOn(coordinator, 'notifySignalingUnhealthy');

    call.checkSignalingHealthForRecovery();

    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('does not let a one-way outbound send mask a dead link in the periodic check', () => {
    const { call, connection, coordinator } = buildCall();
    const notify = jest.spyOn(coordinator, 'notifySignalingUnhealthy');

    // Under the old idleMs-based check this link looked fresh (one-way send).
    connection.idleMs = 1;
    connection.inboundIdleMs = Infinity;
    connection.confirmedOutboundIdleMs = Infinity;

    call.checkSignalingHealthForRecovery();

    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('does not probe a healthy quiet call until iOS parity staleness thresholds are reached', () => {
    const { call, connection, coordinator } = buildCall();
    const notify = jest.spyOn(coordinator, 'notifySignalingUnhealthy');
    connection.inboundIdleMs = 19_999;
    connection.confirmedOutboundIdleMs = 44_999;

    call.checkSignalingHealthForRecovery();

    expect(notify).not.toHaveBeenCalled();
  });

  it('probes when periodic inbound or confirmed outbound staleness thresholds are reached', () => {
    const { call, connection, coordinator } = buildCall();
    const notify = jest.spyOn(coordinator, 'notifySignalingUnhealthy');
    connection.inboundIdleMs = 20_000;
    connection.confirmedOutboundIdleMs = 44_999;

    call.checkSignalingHealthForRecovery();
    expect(notify).toHaveBeenCalledTimes(1);

    notify.mockClear();
    connection.inboundIdleMs = 19_999;
    connection.confirmedOutboundIdleMs = 45_000;

    call.checkSignalingHealthForRecovery();
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('stays silent when the link has confirmed recent traffic', () => {
    const { call, connection, coordinator } = buildCall();
    const notify = jest.spyOn(coordinator, 'notifySignalingUnhealthy');
    connection.inboundIdleMs = 10;
    connection.confirmedOutboundIdleMs = 10;

    call.checkSignalingHealthForRecovery();

    expect(notify).not.toHaveBeenCalled();
  });

  it('ignores the periodic check for non-active calls', () => {
    const { call, coordinator } = buildCall();
    const notify = jest.spyOn(coordinator, 'notifySignalingUnhealthy');
    (call as any).state = 'ended';

    call.checkSignalingHealthForRecovery();

    expect(notify).not.toHaveBeenCalled();
  });

  it('forwards a manual ICE failure when debug mode is enabled', () => {
    const { call, coordinator } = buildCall(true);
    const simulate = jest.spyOn(coordinator, 'simulateIceFailureForTesting').mockReturnValue(true);

    expect(call.simulateIceFailureForTesting()).toBe(true);
    expect(simulate).toHaveBeenCalledTimes(1);
  });

  it('rejects a manual ICE failure when debug mode is disabled', () => {
    const { call, coordinator } = buildCall();
    const simulate = jest.spyOn(coordinator, 'simulateIceFailureForTesting');

    expect(call.simulateIceFailureForTesting()).toBe(false);
    expect(simulate).not.toHaveBeenCalled();
  });
});
