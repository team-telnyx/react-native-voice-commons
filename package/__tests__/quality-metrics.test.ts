import {
  DEFAULT_QUALITY_METRICS_INTERVAL_MS,
  QualityMetricsCollector,
} from '../lib/quality-metrics-collector';
import { CallQualityLevel, calculateMOS, getQuality } from '../lib/quality-metrics';
import type { CallQualityMetrics } from '../lib/quality-metrics';

jest.mock('loglevel', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

/** Drain pending microtasks without advancing fake timers. */
async function flush(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await Promise.resolve();
  }
}

type StatsOverrides = {
  packetsReceived?: number;
  packetsLost?: number;
  inboundJitter?: number;
  inboundAudioLevel?: number;
  outboundAudioLevel?: number;
  mediaSourceAudioLevel?: number;
  remoteJitter?: number | null;
  remoteRtt?: number | null;
  candidateRtt?: number | null;
};

/** A stats report shaped like react-native-webrtc's getStats() result. */
function createStats(overrides: StatsOverrides = {}) {
  const map = new Map<string, any>();
  map.set('IT01', {
    id: 'IT01',
    type: 'inbound-rtp',
    kind: 'audio',
    packetsReceived: overrides.packetsReceived ?? 1000,
    packetsLost: overrides.packetsLost ?? 0,
    jitter: overrides.inboundJitter ?? 0.004,
    audioLevel: overrides.inboundAudioLevel ?? 0.2,
  });
  map.set('OT01', {
    id: 'OT01',
    type: 'outbound-rtp',
    kind: 'audio',
    packetsSent: 1000,
    audioLevel: overrides.outboundAudioLevel,
  });
  if (overrides.mediaSourceAudioLevel !== undefined) {
    map.set('SA1', {
      id: 'SA1',
      type: 'media-source',
      kind: 'audio',
      audioLevel: overrides.mediaSourceAudioLevel,
    });
  }
  if (overrides.remoteJitter !== null || overrides.remoteRtt !== null) {
    map.set('RIA1', {
      id: 'RIA1',
      type: 'remote-inbound-rtp',
      kind: 'audio',
      ...(overrides.remoteJitter !== null ? { jitter: overrides.remoteJitter ?? 0.01 } : {}),
      ...(overrides.remoteRtt !== null ? { roundTripTime: overrides.remoteRtt ?? 0.05 } : {}),
    });
  }
  if (overrides.candidateRtt != null) {
    map.set('CP1', {
      id: 'CP1',
      type: 'candidate-pair',
      nominated: true,
      state: 'succeeded',
      currentRoundTripTime: overrides.candidateRtt,
    });
  }
  return {
    get: (id: string) => map.get(id),
    forEach: (cb: (report: any) => void) => map.forEach((report) => cb(report)),
  };
}

function createPeerConnection(...samples: StatsOverrides[]) {
  const getStats = jest.fn();
  samples.forEach((sample) => getStats.mockResolvedValueOnce(createStats(sample)));
  getStats.mockResolvedValue(createStats(samples[samples.length - 1] ?? {}));
  return { getStats } as any;
}

function startCollector(peerConnection: any, intervalMs?: number) {
  const collector = new QualityMetricsCollector({
    peerConnection,
    callId: 'quality-call',
    intervalMs,
  });
  const samples: CallQualityMetrics[] = [];
  collector.onMetrics = (metrics) => samples.push(metrics);
  collector.start();
  return { collector, samples };
}

describe('calculateMOS (iOS / Android MOSCalculator parity)', () => {
  it.each([
    [10, 50, 1000, 0, 4.3924393982079994],
    [20, 100, 950, 50, 2.874428737304731],
    [30, 200, 900, 100, 2.1691766577491927],
    [5, 400, 500, 500, 1.0005506108428395],
    [0, 0, 0, 0, 4.409285824],
  ])(
    'jitter %dms, rtt %dms, %d received, %d lost -> %d',
    (jitter, rtt, received, lost, expected) => {
      expect(calculateMOS(jitter, rtt, received, lost)).toBeCloseTo(expected, 10);
    }
  );

  it.each([
    [Infinity, 50],
    [10, Infinity],
    [10, -Infinity],
    [NaN, 50],
  ])('returns NaN for non-finite jitter %p / rtt %p', (jitter, rtt) => {
    expect(calculateMOS(jitter, rtt, 1000, 0)).toBeNaN();
  });

  it('stays within 1–5 for finite inputs', () => {
    expect(calculateMOS(1000, 5000, 10, 1000)).toBe(1);
    expect(calculateMOS(0, 0, 1000, 0)).toBeLessThanOrEqual(5);
  });

  it('reports MOS 1 rather than EXCELLENT for extreme latency (R < 0)', () => {
    // ~1.2s one-way latency: the unguarded cubic would clamp this to 5.0.
    const mos = calculateMOS(200, 2000, 1000, 0);
    expect(mos).toBe(1);
    expect(getQuality(mos)).toBe(CallQualityLevel.BAD);
  });
});

describe('getQuality (iOS / Android band parity)', () => {
  it.each([
    [5.0, CallQualityLevel.EXCELLENT],
    [4.3, CallQualityLevel.EXCELLENT],
    [4.2, CallQualityLevel.GOOD],
    [4.15, CallQualityLevel.GOOD],
    [4.1, CallQualityLevel.GOOD],
    [4.05, CallQualityLevel.FAIR],
    [4.0, CallQualityLevel.FAIR],
    [3.7, CallQualityLevel.FAIR],
    [3.65, CallQualityLevel.POOR],
    [3.1, CallQualityLevel.POOR],
    [3.0, CallQualityLevel.BAD],
    [1.0, CallQualityLevel.BAD],
    [0, CallQualityLevel.BAD],
  ])('maps MOS %p to %p', (mos, quality) => {
    expect(getQuality(mos)).toBe(quality);
  });

  it.each([NaN, Infinity, -Infinity, null])('maps %p to UNKNOWN', (mos) => {
    expect(getQuality(mos)).toBe(CallQualityLevel.UNKNOWN);
  });
});

describe('QualityMetricsCollector', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('samples every 200 ms by default, like iOS', () => {
    expect(DEFAULT_QUALITY_METRICS_INTERVAL_MS).toBe(200);
  });

  it('takes the first sample immediately on start', async () => {
    const pc = createPeerConnection({});
    const { samples, collector } = startCollector(pc);
    await flush();

    expect(pc.getStats).toHaveBeenCalledTimes(1);
    expect(samples).toHaveLength(1);
    collector.stop();
  });

  it('samples on each interval and stops cleanly', async () => {
    const pc = createPeerConnection({});
    const { samples, collector } = startCollector(pc, 1000);
    await flush();
    jest.advanceTimersByTime(1000);
    await flush();
    jest.advanceTimersByTime(1000);
    await flush();
    expect(samples).toHaveLength(3);

    collector.stop();
    expect(collector.isActive()).toBe(false);
    jest.advanceTimersByTime(5000);
    await flush();
    expect(samples).toHaveLength(3);
  });

  it('is idempotent and does not start without a peer connection', () => {
    const pc = createPeerConnection({});
    const { collector } = startCollector(pc);
    collector.start();
    expect(pc.getStats).toHaveBeenCalledTimes(1);
    collector.stop();
    collector.stop();

    const orphan = new QualityMetricsCollector({ peerConnection: null, callId: 'x' });
    orphan.start();
    expect(orphan.isActive()).toBe(false);
  });

  it('never overlaps getStats reads when a read is slow', async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    const pc = {
      getStats: jest
        .fn()
        .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
        .mockResolvedValue(createStats()),
    };
    const { collector } = startCollector(pc, 200);

    jest.advanceTimersByTime(1000);
    await flush();
    expect(pc.getStats).toHaveBeenCalledTimes(1);

    resolveFirst(createStats());
    await flush();
    jest.advanceTimersByTime(200);
    await flush();
    expect(pc.getStats).toHaveBeenCalledTimes(2);
    collector.stop();
  });

  it('reports jitter and RTT in seconds from remote-inbound-rtp, with the iOS MOS', async () => {
    const pc = createPeerConnection({ remoteJitter: 0.01, remoteRtt: 0.05, packetsReceived: 1000 });
    const { samples, collector } = startCollector(pc);
    await flush();

    const [metrics] = samples;
    expect(metrics.jitter).toBe(0.01);
    expect(metrics.rtt).toBe(0.05);
    expect(metrics.mos).toBeCloseTo(calculateMOS(10, 50, 1000, 0), 10);
    expect(metrics.quality).toBe(CallQualityLevel.EXCELLENT);
    expect(metrics.remoteInboundAudio).toEqual(
      expect.objectContaining({ type: 'remote-inbound-rtp', roundTripTime: 0.05 })
    );
    expect(metrics.inboundAudio).toEqual(expect.objectContaining({ type: 'inbound-rtp' }));
    collector.stop();
  });

  it('falls back to inbound-rtp jitter and the nominated pair RTT', async () => {
    const pc = createPeerConnection({
      remoteJitter: null,
      remoteRtt: null,
      inboundJitter: 0.02,
      candidateRtt: 0.1,
    });
    const { samples, collector } = startCollector(pc);
    await flush();

    expect(samples[0].jitter).toBe(0.02);
    expect(samples[0].rtt).toBe(0.1);
    expect(samples[0].mos).not.toBeNull();
    collector.stop();
  });

  it('reports UNKNOWN with a null MOS when RTT is unavailable', async () => {
    const pc = createPeerConnection({ remoteRtt: null, candidateRtt: null });
    const { samples, collector } = startCollector(pc);
    await flush();

    expect(samples[0].rtt).toBeNull();
    expect(samples[0].mos).toBeNull();
    expect(samples[0].quality).toBe(CallQualityLevel.UNKNOWN);
    collector.stop();
  });

  it('measures packet loss per sample, so an early loss burst does not stick', async () => {
    const pc = createPeerConnection(
      { packetsReceived: 900, packetsLost: 100 },
      { packetsReceived: 1900, packetsLost: 100 }
    );
    const { samples, collector } = startCollector(pc, 1000);
    await flush();
    jest.advanceTimersByTime(1000);
    await flush();

    // First sample: 10% loss. Second: 1000 received, 0 lost in the interval.
    expect(samples[0].mos).toBeCloseTo(calculateMOS(10, 50, 900, 100), 10);
    expect(samples[1].mos).toBeCloseTo(calculateMOS(10, 50, 1000, 0), 10);
    expect(samples[1].quality).toBe(CallQualityLevel.EXCELLENT);
    collector.stop();
  });

  it('reports audio levels, preferring the media-source level for outbound', async () => {
    const pc = createPeerConnection({
      inboundAudioLevel: 0.3,
      outboundAudioLevel: 0.1,
      mediaSourceAudioLevel: 0.6,
    });
    const { samples, collector } = startCollector(pc);
    await flush();

    expect(samples[0].inboundAudioLevel).toBe(0.3);
    expect(samples[0].outboundAudioLevel).toBe(0.6);
    collector.stop();
  });

  it('keeps sampling after a getStats() rejection', async () => {
    const pc = {
      getStats: jest
        .fn()
        .mockRejectedValueOnce(new Error('closed'))
        .mockResolvedValue(createStats()),
    };
    const { samples, collector } = startCollector(pc, 200);
    await flush();
    expect(samples).toHaveLength(0);

    jest.advanceTimersByTime(200);
    await flush();
    expect(samples).toHaveLength(1);
    collector.stop();
  });
});
