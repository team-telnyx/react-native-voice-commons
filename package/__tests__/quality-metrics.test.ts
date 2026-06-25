import { QualityMetricsCollector } from '../lib/quality-metrics-collector';
import {
  CallQualityLevel,
  estimateMOS,
  qualityLevelFromMOS,
  round4,
} from '../lib/quality-metrics';
import type { CallQualityMetrics } from '../lib/quality-metrics';

// Mock loglevel
jest.mock('loglevel', () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

function createMockPeerConnection(statsMap: Map<string, any> = new Map()) {
  return {
    getStats: jest.fn().mockResolvedValue({
      get: (id: string) => statsMap.get(id),
      forEach: (cb: (report: any) => void) => {
        statsMap.forEach((report) => cb(report));
      },
    }),
  } as any;
}

function createAudioStatsMap(overrides: {
  packetsReceived?: number;
  packetsLost?: number;
  jitter?: number | null;
  audioLevel?: number | null;
  bytesReceived?: number;
  packetsSent?: number;
  bytesSent?: number;
  audioLevelOut?: number | null;
  currentRoundTripTime?: number | null;
  timestamp?: number;
} = {}) {
  const ts = overrides.timestamp ?? Date.now();
  const map = new Map<string, any>();
  map.set('inbound', {
    type: 'inbound-rtp',
    kind: 'audio',
    timestamp: ts,
    packetsReceived: overrides.packetsReceived ?? 1000,
    packetsLost: overrides.packetsLost ?? 10,
    jitter: overrides.jitter ?? 0.005, // 5ms in seconds
    audioLevel: overrides.audioLevel ?? 0.5,
    bytesReceived: overrides.bytesReceived ?? 64000,
  });
  map.set('outbound', {
    type: 'outbound-rtp',
    kind: 'audio',
    timestamp: ts,
    packetsSent: overrides.packetsSent ?? 950,
    bytesSent: overrides.bytesSent ?? 60000,
    mediaSourceId: 'media-src-1',
  });
  map.set('candidate-pair', {
    type: 'candidate-pair',
    nominated: true,
    state: 'succeeded',
    currentRoundTripTime: overrides.currentRoundTripTime ?? 0.05, // 50ms in seconds
  });
  return map;
}

describe('round4', () => {
  it('rounds to 4 decimal places', () => {
    expect(round4(3.14159265)).toBe(3.1416);
    expect(round4(1.23456789)).toBe(1.2346);
  });

  it('returns null for null/undefined/NaN', () => {
    expect(round4(null)).toBeNull();
    expect(round4(undefined)).toBeNull();
    expect(round4(NaN)).toBeNull();
  });

  it('handles zero', () => {
    expect(round4(0)).toBe(0);
  });
});

describe('estimateMOS', () => {
  it('returns null when both jitter and rtt are null', () => {
    expect(estimateMOS(null, null, null)).toBeNull();
  });

  it('returns a high MOS for excellent conditions', () => {
    const mos = estimateMOS(5, 20, 0);
    expect(mos).not.toBeNull();
    expect(mos!).toBeGreaterThan(3.9);
  });

  it('returns a lower MOS for poor conditions (high loss)', () => {
    const mos = estimateMOS(20, 200, 10);
    expect(mos).not.toBeNull();
    expect(mos!).toBeLessThan(3.1);
  });

  it('returns 1 for extremely bad conditions', () => {
    const mos = estimateMOS(100, 1000, 80);
    expect(mos).toBe(1);
  });

  it('clamps MOS to 4.5 for perfect conditions', () => {
    const mos = estimateMOS(0, 0, 0);
    expect(mos).not.toBeNull();
    expect(mos!).toBeLessThanOrEqual(4.5);
  });

  it('handles null jitter with valid rtt', () => {
    const mos = estimateMOS(null, 30, 0);
    expect(mos).not.toBeNull();
    expect(mos!).toBeGreaterThan(3.9);
  });

  it('handles null rtt with valid jitter', () => {
    const mos = estimateMOS(5, null, 0);
    expect(mos).not.toBeNull();
    expect(mos!).toBeGreaterThan(3.5);
  });

  it('handles null packet loss rate (treats as 0)', () => {
    const mos = estimateMOS(5, 20, null);
    expect(mos).not.toBeNull();
    expect(mos!).toBeGreaterThan(3.9);
  });
});

describe('qualityLevelFromMOS', () => {
  it('returns EXCELLENT for MOS >= 4.0', () => {
    expect(qualityLevelFromMOS(4.0)).toBe(CallQualityLevel.EXCELLENT);
    expect(qualityLevelFromMOS(4.5)).toBe(CallQualityLevel.EXCELLENT);
  });

  it('returns GOOD for MOS >= 3.6', () => {
    expect(qualityLevelFromMOS(3.6)).toBe(CallQualityLevel.GOOD);
    expect(qualityLevelFromMOS(3.9)).toBe(CallQualityLevel.GOOD);
  });

  it('returns FAIR for MOS >= 3.1', () => {
    expect(qualityLevelFromMOS(3.1)).toBe(CallQualityLevel.FAIR);
    expect(qualityLevelFromMOS(3.5)).toBe(CallQualityLevel.FAIR);
  });

  it('returns POOR for MOS >= 2.6', () => {
    expect(qualityLevelFromMOS(2.6)).toBe(CallQualityLevel.POOR);
    expect(qualityLevelFromMOS(3.0)).toBe(CallQualityLevel.POOR);
  });

  it('returns BAD for MOS < 2.6', () => {
    expect(qualityLevelFromMOS(2.5)).toBe(CallQualityLevel.BAD);
    expect(qualityLevelFromMOS(1.0)).toBe(CallQualityLevel.BAD);
  });

  it('returns FAIR for null MOS (conservative default)', () => {
    expect(qualityLevelFromMOS(null)).toBe(CallQualityLevel.FAIR);
  });
});

describe('QualityMetricsCollector', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('creates a collector with default interval', () => {
      const pc = createMockPeerConnection();
      const collector = new QualityMetricsCollector({
        peerConnection: pc,
        callId: 'test-call-1',
      });
      expect(collector).toBeDefined();
      expect(collector.isActive()).toBe(false);
    });

    it('accepts custom interval', () => {
      const pc = createMockPeerConnection();
      const collector = new QualityMetricsCollector({
        peerConnection: pc,
        callId: 'test-call-1',
        intervalMs: 2000,
      });
      expect(collector).toBeDefined();
    });
  });

  describe('start / stop', () => {
    it('starts collection and becomes active', () => {
      const pc = createMockPeerConnection();
      const collector = new QualityMetricsCollector({
        peerConnection: pc,
        callId: 'test-call-1',
      });
      collector.start();
      expect(collector.isActive()).toBe(true);
      collector.stop();
    });

    it('is idempotent — start() twice is a no-op', () => {
      const pc = createMockPeerConnection();
      const collector = new QualityMetricsCollector({
        peerConnection: pc,
        callId: 'test-call-1',
      });
      collector.start();
      collector.start();
      expect(collector.isActive()).toBe(true);
      collector.stop();
    });

    it('stop() deactivates the collector', () => {
      const pc = createMockPeerConnection();
      const collector = new QualityMetricsCollector({
        peerConnection: pc,
        callId: 'test-call-1',
      });
      collector.start();
      expect(collector.isActive()).toBe(true);
      collector.stop();
      expect(collector.isActive()).toBe(false);
    });

    it('stop() is idempotent when not running', () => {
      const pc = createMockPeerConnection();
      const collector = new QualityMetricsCollector({
        peerConnection: pc,
        callId: 'test-call-1',
      });
      collector.stop();
      expect(collector.isActive()).toBe(false);
    });

    it('does not start without a peer connection', () => {
      const collector = new QualityMetricsCollector({
        peerConnection: null as any,
        callId: 'test-call-1',
      });
      collector.start();
      expect(collector.isActive()).toBe(false);
    });
  });

  describe('metrics collection', () => {
    it('collects metrics on each interval and calls onMetrics', async () => {
      const statsMap = createAudioStatsMap();
      const pc = createMockPeerConnection(statsMap);
      const collected: CallQualityMetrics[] = [];

      const collector = new QualityMetricsCollector({
        peerConnection: pc,
        callId: 'test-call-1',
        intervalMs: 1000,
      });
      collector.onMetrics = (m) => collected.push(m);

      collector.start();
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();

      expect(pc.getStats).toHaveBeenCalledTimes(1);
      expect(collected.length).toBe(1);

      const metrics = collected[0];
      expect(metrics.callId).toBe('test-call-1');
      expect(metrics.timestamp).toBeDefined();
      expect(metrics.qualityLevel).toBeDefined();
      expect(metrics.inbound).not.toBeNull();
      expect(metrics.inbound!.packetsReceived).toBe(1000);
      expect(metrics.inbound!.packetsLost).toBe(10);
      expect(metrics.inbound!.jitter).toBe(5); // 0.005s -> 5ms
      expect(metrics.outbound).not.toBeNull();
      expect(metrics.outbound!.packetsSent).toBe(950);
      expect(metrics.roundTripTime).toBe(50); // 0.05s -> 50ms

      collector.stop();
    });

    it('collects multiple samples over multiple intervals', async () => {
      const statsMap = createAudioStatsMap();
      const pc = createMockPeerConnection(statsMap);
      const collected: CallQualityMetrics[] = [];

      const collector = new QualityMetricsCollector({
        peerConnection: pc,
        callId: 'test-call-1',
        intervalMs: 1000,
      });
      collector.onMetrics = (m) => collected.push(m);

      collector.start();
      for (let i = 0; i < 3; i++) {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
        await Promise.resolve();
      }

      expect(collected.length).toBe(3);
      collector.stop();
    });

    it('computes packet loss rate correctly', async () => {
      const statsMap = createAudioStatsMap({
        packetsReceived: 2000,
        packetsLost: 100,
      });
      const pc = createMockPeerConnection(statsMap);
      const collected: CallQualityMetrics[] = [];

      const collector = new QualityMetricsCollector({
        peerConnection: pc,
        callId: 'test-call-1',
        intervalMs: 1000,
      });
      collector.onMetrics = (m) => collected.push(m);

      collector.start();
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();

      expect(collected[0].packetLossRate).toBe(5); // 100/2000 * 100 = 5%
      collector.stop();
    });

    it('normalizes missing fields to null', async () => {
      const map = new Map<string, any>();
      map.set('inbound', {
        type: 'inbound-rtp',
        kind: 'audio',
        timestamp: Date.now(),
        packetsReceived: 500,
        packetsLost: 0,
        // jitter, audioLevel, bytesReceived missing
      });
      const pc = createMockPeerConnection(map);
      const collected: CallQualityMetrics[] = [];

      const collector = new QualityMetricsCollector({
        peerConnection: pc,
        callId: 'test-call-1',
        intervalMs: 1000,
      });
      collector.onMetrics = (m) => collected.push(m);

      collector.start();
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();

      const metrics = collected[0];
      expect(metrics.inbound).not.toBeNull();
      expect(metrics.inbound!.jitter).toBeNull();
      expect(metrics.inbound!.audioLevel).toBeNull();
      expect(metrics.inbound!.bitrateAvg).toBeNull();
      expect(metrics.inbound!.packetsReceived).toBe(500);
      expect(metrics.inbound!.packetsLost).toBe(0);
      // outbound should be null since no outbound-rtp report
      expect(metrics.outbound).toBeNull();
      // rtt should be null since no candidate-pair
      expect(metrics.roundTripTime).toBeNull();

      collector.stop();
    });

    it('does not crash when getStats rejects', async () => {
      const pc = {
        getStats: jest.fn().mockRejectedValue(new Error('getStats failed')),
      } as any;
      const collected: CallQualityMetrics[] = [];

      const collector = new QualityMetricsCollector({
        peerConnection: pc,
        callId: 'test-call-1',
        intervalMs: 1000,
      });
      collector.onMetrics = (m) => collected.push(m);

      collector.start();
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(collected.length).toBe(0);
      collector.stop();
    });

    it('computes bitrate on second sample using delta', async () => {
      const ts1 = 1000;
      const ts2 = 2000;
      let callCount = 0;
      const statsMap1 = new Map<string, any>();
      statsMap1.set('inbound', {
        type: 'inbound-rtp',
        kind: 'audio',
        timestamp: ts1,
        packetsReceived: 1000,
        packetsLost: 0,
        jitter: 0.003,
        bytesReceived: 64000,
      });

      const statsMap2 = new Map<string, any>();
      statsMap2.set('inbound', {
        type: 'inbound-rtp',
        kind: 'audio',
        timestamp: ts2,
        packetsReceived: 2000,
        packetsLost: 0,
        jitter: 0.003,
        bytesReceived: 128000,
      });

      const pc = {
        getStats: jest.fn(() => {
          callCount++;
          return Promise.resolve(
            callCount === 1
              ? {
                  get: (id: string) => statsMap1.get(id),
                  forEach: (cb: (r: any) => void) => statsMap1.forEach((r) => cb(r)),
                }
              : {
                  get: (id: string) => statsMap2.get(id),
                  forEach: (cb: (r: any) => void) => statsMap2.forEach((r) => cb(r)),
                }
          );
        }),
      } as any;

      const collected: CallQualityMetrics[] = [];
      const collector = new QualityMetricsCollector({
        peerConnection: pc,
        callId: 'test-call-1',
        intervalMs: 1000,
      });
      collector.onMetrics = (m) => collected.push(m);

      collector.start();

      // First interval
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();

      // Second interval
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();

      expect(collected.length).toBe(2);
      // First sample: bitrateAvg should be null (no previous baseline)
      expect(collected[0].inbound!.bitrateAvg).toBeNull();
      // Second sample: bitrateAvg should be computed
      // delta = (128000 - 64000) * 8 * 1000 / (2000 - 1000) = 512000 bps
      expect(collected[1].inbound!.bitrateAvg).toBe(512000);

      collector.stop();
    });
  });
});
