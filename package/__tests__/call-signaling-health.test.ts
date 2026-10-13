import { Call } from '../lib/call';
import type { Connection } from '../lib/connection';

function buildCall() {
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
  });

  const coordinator = (call as any).recoveryCoordinator;
  return { call, connection, coordinator };
}

describe('Call signaling health checks (ICE restart recovery)', () => {
  it('treats a confirmed request/response exchange as fresh signaling', () => {
    const { call, connection, coordinator } = buildCall();
    connection.inboundIdleMs = 10;
    connection.confirmedOutboundIdleMs = 10;

    const isSignalingFresh = coordinator.deps.isSignalingFresh;
    expect(isSignalingFresh()).toBe(true);
  });

  it('does not let one-way outbound sends mask a dead link', () => {
    const { call, connection, coordinator } = buildCall();

    // Only a client-initiated send happened (total idle is fresh), but no
    // inbound message and no confirmed outbound response were ever observed.
    connection.idleMs = 1;
    connection.inboundIdleMs = Infinity;
    connection.confirmedOutboundIdleMs = Infinity;

    const isSignalingFresh = coordinator.deps.isSignalingFresh;
    expect(isSignalingFresh()).toBe(false);
  });

  it('treats inbound traffic without a confirmed outbound exchange as stale', () => {
    const { call, connection, coordinator } = buildCall();
    connection.inboundIdleMs = 10;
    connection.confirmedOutboundIdleMs = 10_000;

    const isSignalingFresh = coordinator.deps.isSignalingFresh;
    expect(isSignalingFresh()).toBe(false);
  });

  it('reports stale signaling when the socket is disconnected', () => {
    const { call, connection, coordinator } = buildCall();
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
});
