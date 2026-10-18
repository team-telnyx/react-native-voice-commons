import { Call } from '../lib/call';
import { CallReportCollector } from '../lib/call-report-collector';
import type { Connection } from '../lib/connection';
import { resolveSignalingHost, TelnyxEnvironment } from '../lib/env';
import { updateCallReportId, updateVoiceSDKId } from '../lib/global';

jest.mock('loglevel', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  setLevel: jest.fn(),
}));

function buildCall(environment: TelnyxEnvironment) {
  const connection: any = {
    addListener: jest.fn(),
    send: jest.fn(),
    sendAndWait: jest.fn(),
    isConnected: true,
    // Same shape Connection exposes: the bare signaling host, no query params.
    host: resolveSignalingHost(environment),
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

  // Real collector so the endpoint is built by production code; only the
  // stats/log plumbing that needs a live peer connection is stubbed.
  const collector = new CallReportCollector({
    enableCallReports: true,
    callReportInterval: 5,
    callReportLogLevel: 'debug',
    callReportMaxLogEntries: 1000,
  });
  const payload = { summary: { callId: 'signaling-call-id' }, stats: [], logs: [] } as any;
  jest.spyOn(collector, 'stop').mockResolvedValue(undefined);
  jest.spyOn(collector, 'buildPayload').mockReturnValue(payload);
  jest.spyOn(collector, 'flush').mockReturnValue({ ...payload, segment: 0 });
  (call as any).callReportCollector = collector;

  return call;
}

async function flushPromises() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

describe('Call report routing', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    updateCallReportId('report-id');
    updateVoiceSDKId('voice-sdk-id');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    updateCallReportId(null);
    updateVoiceSDKId(null);
    jest.restoreAllMocks();
  });

  it.each([
    ['production', 'https://rtc.telnyx.com/call_report'],
    ['development', 'https://rtcdev.telnyx.com/call_report'],
  ] as const)(
    'posts the final %s report to the signaling environment ingest',
    async (environment, expectedEndpoint) => {
      const call = buildCall(environment);

      await (call as any).stopAndPostCallReport('done');
      await flushPromises();

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(expectedEndpoint);
    }
  );

  it.each([
    ['production', 'https://rtc.telnyx.com/call_report'],
    ['development', 'https://rtcdev.telnyx.com/call_report'],
  ] as const)(
    'posts intermediate %s report segments to the signaling environment ingest',
    async (environment, expectedEndpoint) => {
      const call = buildCall(environment);

      (call as any).flushIntermediateReport();
      await flushPromises();

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(expectedEndpoint);
    }
  );
});
