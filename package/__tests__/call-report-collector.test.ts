import { CallReportCollector } from '../lib/call-report-collector';
import type {
  CallReportConfig,
  CallReportSummary,
} from '../lib/call-report-models';

// Mock loglevel
jest.mock('loglevel', () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const DEFAULT_CONFIG: CallReportConfig = {
  enableCallReports: true,
  callReportInterval: 5,
  callReportLogLevel: 'debug',
  callReportMaxLogEntries: 1000,
};

const MOCK_SUMMARY: CallReportSummary = {
  callId: 'test-call-123',
  direction: 'OUTGOING',
  state: 'done',
  durationSeconds: 60,
  sdkVersion: '0.3.0',
  startTimestamp: '2026-03-19T00:00:00.000Z',
  endTimestamp: '2026-03-19T00:01:00.000Z',
};

function createMockPeerConnection(statsMap: Map<string, any> = new Map()) {
  return {
    getStats: jest.fn().mockResolvedValue({
      forEach: (cb: (report: any) => void) => {
        statsMap.forEach((report) => cb(report));
      },
    }),
  } as any;
}

describe('CallReportCollector', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('creates a collector with the given config', () => {
      const collector = new CallReportCollector(DEFAULT_CONFIG);
      expect(collector).toBeDefined();
    });
  });

  describe('log', () => {
    it('adds log entries that appear in the payload', () => {
      const collector = new CallReportCollector(DEFAULT_CONFIG);
      collector.log('info', 'test log', { data: 123 });

      const payload = collector.buildPayload(MOCK_SUMMARY);
      // The constructor adds one log + our log
      const ourLog = payload.logs.find((l) => l.message === 'test log');
      expect(ourLog).toBeDefined();
      expect(ourLog!.level).toBe('info');
      expect(ourLog!.context).toEqual({ data: 123 });
    });
  });

  describe('start / stop', () => {
    it('starts periodic stats collection', () => {
      const collector = new CallReportCollector(DEFAULT_CONFIG);
      const mockPC = createMockPeerConnection();

      collector.start(mockPC);

      // Advance by one interval
      jest.advanceTimersByTime(5000);
      expect(mockPC.getStats).toHaveBeenCalledTimes(1);

      // Advance by another interval
      jest.advanceTimersByTime(5000);
      expect(mockPC.getStats).toHaveBeenCalledTimes(2);

      collector.stop();
    });

    it('stops collection on stop()', () => {
      const collector = new CallReportCollector(DEFAULT_CONFIG);
      const mockPC = createMockPeerConnection();

      collector.start(mockPC);
      jest.advanceTimersByTime(5000);
      expect(mockPC.getStats).toHaveBeenCalledTimes(1);

      collector.stop();
      jest.advanceTimersByTime(10000);
      // No more calls after stop
      expect(mockPC.getStats).toHaveBeenCalledTimes(1);
    });

    it('does not start without a peer connection', () => {
      const collector = new CallReportCollector(DEFAULT_CONFIG);
      collector.start(null as any);
      // Should not throw, just warn
      jest.advanceTimersByTime(5000);
    });

    it('only starts once (idempotent)', () => {
      const collector = new CallReportCollector(DEFAULT_CONFIG);
      const mockPC = createMockPeerConnection();

      collector.start(mockPC);
      collector.start(mockPC); // second call ignored

      jest.advanceTimersByTime(5000);
      expect(mockPC.getStats).toHaveBeenCalledTimes(1);

      collector.stop();
    });
  });

  describe('buildPayload', () => {
    it('returns payload with summary, stats, and logs', () => {
      const collector = new CallReportCollector(DEFAULT_CONFIG);
      const payload = collector.buildPayload(MOCK_SUMMARY);

      expect(payload.summary).toBe(MOCK_SUMMARY);
      expect(payload.stats).toEqual([]);
      expect(payload.logs).toBeDefined();
      expect(payload.segment).toBeUndefined();
    });

    it('includes collected stats intervals', async () => {
      const statsMap = new Map();
      statsMap.set('outbound', {
        type: 'outbound-rtp',
        kind: 'audio',
        packetsSent: 100,
        bytesSent: 5000,
        timestamp: 1000,
      });
      statsMap.set('inbound', {
        type: 'inbound-rtp',
        kind: 'audio',
        packetsReceived: 90,
        bytesReceived: 4500,
        packetsLost: 2,
        packetsDiscarded: 0,
        jitter: 0.015,
        audioLevel: 0.5,
        timestamp: 1000,
      });

      const collector = new CallReportCollector(DEFAULT_CONFIG);
      const mockPC = createMockPeerConnection(statsMap);
      collector.start(mockPC);

      jest.advanceTimersByTime(5000);
      // Let the async getStats resolve
      await Promise.resolve();

      collector.stop();

      const payload = collector.buildPayload(MOCK_SUMMARY);
      expect(payload.stats).toHaveLength(1);

      const interval = payload.stats[0];
      expect(interval.intervalStartUtc).toBeDefined();
      expect(interval.intervalEndUtc).toBeDefined();
      expect(interval.audio.outbound).toBeDefined();
      expect(interval.audio.outbound!.packetsSent).toBe(100);
      expect(interval.audio.outbound!.bytesSent).toBe(5000);
      expect(interval.audio.inbound).toBeDefined();
      expect(interval.audio.inbound!.packetsReceived).toBe(90);
      expect(interval.audio.inbound!.packetsLost).toBe(2);
    });
  });

  describe('flush', () => {
    it('returns current data and clears buffers', async () => {
      const statsMap = new Map();
      statsMap.set('outbound', {
        type: 'outbound-rtp',
        kind: 'audio',
        packetsSent: 50,
        bytesSent: 2000,
        timestamp: 1000,
      });

      const collector = new CallReportCollector(DEFAULT_CONFIG);
      const mockPC = createMockPeerConnection(statsMap);

      collector.log('info', 'pre-flush log');
      collector.start(mockPC);

      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      const flushed = collector.flush(MOCK_SUMMARY);
      expect(flushed.segment).toBe(0);
      expect(flushed.stats.length).toBeGreaterThan(0);
      expect(flushed.logs.length).toBeGreaterThan(0);

      // After flush, buffers should be empty
      const afterFlush = collector.buildPayload(MOCK_SUMMARY);
      expect(afterFlush.stats).toHaveLength(0);
      // segment index incremented
      expect(afterFlush.segment).toBe(1);

      collector.stop();
    });

    it('increments segment index on each flush', () => {
      const collector = new CallReportCollector(DEFAULT_CONFIG);

      const first = collector.flush(MOCK_SUMMARY);
      expect(first.segment).toBe(0);

      const second = collector.flush(MOCK_SUMMARY);
      expect(second.segment).toBe(1);

      const third = collector.flush(MOCK_SUMMARY);
      expect(third.segment).toBe(2);
    });
  });

  describe('onFlushNeeded callback', () => {
    it('fires when stats buffer reaches threshold', async () => {
      const config: CallReportConfig = {
        ...DEFAULT_CONFIG,
        callReportInterval: 1, // 1s intervals for faster test
      };

      const collector = new CallReportCollector(config);
      const mockPC = createMockPeerConnection();
      const flushSpy = jest.fn();
      collector.onFlushNeeded = flushSpy;

      collector.start(mockPC);

      // Advance enough to fill beyond STATS_FLUSH_THRESHOLD (300)
      for (let i = 0; i < 301; i++) {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
      }

      expect(flushSpy).toHaveBeenCalled();

      collector.stop();
    });
  });

  describe('sendPayload', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('POSTs payload to the correct endpoint', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const collector = new CallReportCollector(DEFAULT_CONFIG);
      const payload = collector.buildPayload(MOCK_SUMMARY);

      await collector.sendPayload(payload, 'report-id-1', 'wss://rtc.telnyx.com', 'voice-sdk-123');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('https://rtc.telnyx.com/call_report');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.headers['x-call-report-id']).toBe('report-id-1');
      expect(options.headers['x-call-id']).toBe('test-call-123');
      expect(options.headers['x-voice-sdk-id']).toBe('voice-sdk-123');
    });

    it('converts ws:// host to http://', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });

      const collector = new CallReportCollector(DEFAULT_CONFIG);
      const payload = collector.buildPayload(MOCK_SUMMARY);

      await collector.sendPayload(payload, 'id', 'ws://rtcdev.telnyx.com');

      const [url] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('http://rtcdev.telnyx.com/call_report');
    });

    it('skips sending when callReportId is missing', async () => {
      const collector = new CallReportCollector(DEFAULT_CONFIG);
      const payload = collector.buildPayload(MOCK_SUMMARY);

      await collector.sendPayload(payload, '', 'wss://rtc.telnyx.com');

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('does not retry on 4xx errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue('Bad Request'),
      });

      const collector = new CallReportCollector(DEFAULT_CONFIG);
      const payload = collector.buildPayload(MOCK_SUMMARY);

      await collector.sendPayload(payload, 'id', 'wss://rtc.telnyx.com');

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('stats processing', () => {
    it('calculates bitrate from consecutive intervals', async () => {
      const statsMap = new Map();
      statsMap.set('outbound', {
        type: 'outbound-rtp',
        kind: 'audio',
        packetsSent: 100,
        bytesSent: 5000,
        timestamp: 1000,
      });

      const collector = new CallReportCollector(DEFAULT_CONFIG);
      const mockPC = createMockPeerConnection(statsMap);
      collector.start(mockPC);

      // First interval - no bitrate (no previous data)
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      // Update stats for second interval
      statsMap.set('outbound', {
        type: 'outbound-rtp',
        kind: 'audio',
        packetsSent: 200,
        bytesSent: 10000,
        timestamp: 6000,
      });

      // Second interval - should have bitrate
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      collector.stop();

      const payload = collector.buildPayload(MOCK_SUMMARY);
      expect(payload.stats).toHaveLength(2);
      // Second interval should have a bitrate calculation
      expect(payload.stats[1].audio.outbound!.bitrateAvg).not.toBeNull();
    });

    it('processes connection stats from candidate-pair', async () => {
      const statsMap = new Map();
      statsMap.set('pair', {
        type: 'candidate-pair',
        nominated: true,
        state: 'succeeded',
        currentRoundTripTime: 0.05,
        packetsSent: 100,
        packetsReceived: 95,
        bytesSent: 5000,
        bytesReceived: 4750,
      });

      const collector = new CallReportCollector(DEFAULT_CONFIG);
      const mockPC = createMockPeerConnection(statsMap);
      collector.start(mockPC);

      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      collector.stop();

      const payload = collector.buildPayload(MOCK_SUMMARY);
      const conn = payload.stats[0].connection;
      expect(conn).toBeDefined();
      expect(conn!.roundTripTimeAvg).toBe(0.05);
      expect(conn!.packetsSent).toBe(100);
      expect(conn!.packetsReceived).toBe(95);
    });
  });
});
