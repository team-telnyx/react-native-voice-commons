import { Call } from '../lib/call';
import type { CallReportPayload, CallReportSummary } from '../lib/call-report-models';
import type { Connection } from '../lib/connection';

const REPORT_CONFIG = {
  enableCallReports: true,
  callReportInterval: 5,
  callReportLogLevel: 'debug',
  callReportMaxLogEntries: 1000,
};

const SUMMARY: CallReportSummary = {
  callId: 'signaling-call-id',
  direction: 'INCOMING',
  state: 'active',
  durationSeconds: null,
  sdkVersion: '1.1.0',
  startTimestamp: '2026-10-20T00:00:00.000Z',
  endTimestamp: null,
};

function buildCall() {
  const connection: any = {
    addListener: jest.fn(),
    sendAndWait: jest.fn().mockResolvedValue({
      id: 'modify-id',
      jsonrpc: '2.0',
      result: {
        action: 'updateMedia',
        callID: 'signaling-call-id',
        sdp: 'answer-sdp',
        sessid: 'session-id',
      },
      voice_sdk_id: 'voice-sdk-id',
    }),
    isConnected: true,
    inboundIdleMs: 0,
    confirmedOutboundIdleMs: 0,
  };
  const peer = {
    restartIce: jest.fn().mockResolvedValue('offer-sdp'),
    setRemoteDescriptionStrict: jest.fn().mockResolvedValue(undefined),
    finishIceRestart: jest.fn(),
  };
  const call = new Call({
    connection: connection as Connection,
    options: { destinationNumber: '+155****4567' },
    sessionId: 'session-id',
    direction: 'inbound',
    callId: 'signaling-call-id',
    telnyxLegId: 'telnyx-leg-id',
    telnyxSessionId: 'telnyx-session-id',
    callState: 'active',
    callReportConfig: REPORT_CONFIG,
  });
  (call as any).peer = peer;

  const monitor = (call as any).signalingHealthMonitor;
  const payload = (): CallReportPayload => (call as any).callReportCollector.buildPayload(SUMMARY);

  return { call, connection, monitor, payload, peer };
}

function logMessages(payload: CallReportPayload): string[] {
  return payload.logs.map((entry) => entry.message);
}

describe('ICE restart call-report lifecycle', () => {
  it('records the successful iOS-parity lifecycle in the report payload', async () => {
    const { monitor, payload, peer } = buildCall();

    const offer = await monitor.deps.restartIce();
    const answer = await monitor.deps.sendUpdateMedia(offer);
    await monitor.deps.applyRemoteAnswer(answer);
    monitor.deps.onRecovered('iceRestart');

    expect(peer.finishIceRestart).toHaveBeenCalledTimes(1);
    expect(logMessages(payload())).toEqual(
      expect.arrayContaining([
        'ICE restart: initiated',
        'ICE restart: sending Modify with new offer SDP',
        'ICE restart Modify response received',
        'ICE restart remote SDP applied',
        'ICE restart recovery succeeded',
      ])
    );
    expect(
      payload().logs.find((entry) => entry.message === 'ICE restart: initiated')?.context
    ).toEqual(expect.objectContaining({ callId: 'signaling-call-id', sessionId: 'session-id' }));
  });

  it('records offer, Modify response, and remote SDP failures without reporting SDP', async () => {
    const { connection, monitor, payload, peer } = buildCall();

    peer.restartIce.mockRejectedValueOnce(new Error('offer failed'));
    await expect(monitor.deps.restartIce()).rejects.toThrow('offer failed');

    connection.sendAndWait.mockResolvedValueOnce({
      jsonrpc: '2.0',
      result: { action: 'updateMedia', callID: 'signaling-call-id' },
    });
    await expect(monitor.deps.sendUpdateMedia('offer-sdp')).rejects.toThrow(
      '[Call] Invalid updateMedia response'
    );

    connection.sendAndWait.mockResolvedValueOnce({
      jsonrpc: '2.0',
      result: { action: 'updateMedia', callID: 'signaling-call-id', sdp: 'secret-sdp' },
    });
    await expect(monitor.deps.sendUpdateMedia('offer-sdp')).rejects.toThrow(
      '[Call] Invalid updateMedia response'
    );

    peer.setRemoteDescriptionStrict.mockRejectedValueOnce(new Error('remote SDP rejected'));
    await expect(monitor.deps.applyRemoteAnswer('answer-sdp')).rejects.toThrow(
      'remote SDP rejected'
    );

    const report = payload();
    expect(logMessages(report)).toEqual(
      expect.arrayContaining([
        'ICE restart offer creation failed',
        'ICE restart Modify response missing SDP',
        'ICE restart Modify response invalid',
        'ICE restart remote SDP apply failed',
      ])
    );
    expect(JSON.stringify(report.logs)).not.toContain('secret-sdp');
    expect(JSON.stringify(report.logs)).not.toContain('answer-sdp');
  });

  it('distinguishes a successful reattach from an ICE restart success', () => {
    const { call, payload } = buildCall();

    call.reportRecoveryReattachOutcome(true);

    expect(logMessages(payload())).toContain('Recovery reattach succeeded');
    expect(logMessages(payload())).not.toContain('ICE restart recovery succeeded');
  });
});
