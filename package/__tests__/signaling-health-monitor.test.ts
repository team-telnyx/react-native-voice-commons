import { SignalingHealthMonitor } from '../lib/signaling-health-monitor';
import type { SignalingHealthMonitorDeps } from '../lib/signaling-health-monitor';

// Mock loglevel (matches repo test conventions)
jest.mock('loglevel', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const DEBOUNCE_MS = 3000;
const PROBE_TIMEOUT_MS = 5000;
const RESTART_TIMEOUT_MS = 15000;
const VERIFY_WINDOW_MS = 5000;
const VERIFY_POLL_MS = 1000;

/** Inbound and confirmed request/response traffic seen just now. */
const FRESH_SIGNALING = {
  inboundSignalingIdleMs: jest.fn().mockReturnValue(0),
  confirmedOutboundIdleMs: jest.fn().mockReturnValue(0),
};

/** Inbound traffic past the 20s periodic staleness threshold. */
const STALE_SIGNALING = {
  inboundSignalingIdleMs: jest.fn().mockReturnValue(20_000),
  confirmedOutboundIdleMs: jest.fn().mockReturnValue(0),
};

/** Drain pending microtasks without advancing fake timers. */
async function flush(): Promise<void> {
  for (let i = 0; i < 12; i += 1) {
    await Promise.resolve();
    await Promise.resolve();
  }
}

function createDeps(overrides: Partial<SignalingHealthMonitorDeps> = {}) {
  // mocks doubles as the source of deps so that test overrides and
  // assertions always observe the same functions the coordinator invokes.
  const mocks = {
    callState: jest.fn().mockReturnValue('active'),
    isSignalingAvailable: jest.fn().mockReturnValue(true),
    // Neither recent enough to skip the probe nor stale for the health check.
    inboundSignalingIdleMs: jest.fn().mockReturnValue(10_000),
    confirmedOutboundIdleMs: jest.fn().mockReturnValue(10_000),
    isClientReconnecting: jest.fn().mockReturnValue(false),
    sendSignalingProbe: jest.fn().mockResolvedValue('ok' as const),
    restartIce: jest.fn().mockResolvedValue('offer-sdp'),
    sendUpdateMedia: jest.fn().mockResolvedValue('answer-sdp'),
    applyRemoteAnswer: jest.fn().mockResolvedValue(undefined),
    getInboundAudioPackets: jest.fn().mockResolvedValue(100),
    getPeerIceState: jest.fn().mockReturnValue('disconnected'),
    getPeerConnectionState: jest.fn().mockReturnValue('connected'),
    getSelectedCandidateEvidence: jest.fn().mockReturnValue(null),
    performReattachFallback: jest.fn().mockResolvedValue(false),
    onCandidateEvidenceCaptured: jest.fn(),
    onRecovered: jest.fn(),
    onRecoveryFailed: jest.fn(),
  };

  Object.assign(mocks, overrides);

  const deps: SignalingHealthMonitorDeps = {
    callId: 'recovery-call-id',
    ...mocks,
  };

  return { deps, mocks };
}

describe('SignalingHealthMonitor', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('guards', () => {
    it('ignores failures on non-active calls', async () => {
      const { deps, mocks } = createDeps({ callState: jest.fn().mockReturnValue('held') });
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.notifyIceFailure('failed');
      await flush();

      expect(mocks.restartIce).not.toHaveBeenCalled();
      expect(mocks.sendSignalingProbe).not.toHaveBeenCalled();
      expect(mocks.performReattachFallback).not.toHaveBeenCalled();
      expect(coordinator.isRecoveryActive).toBe(false);
    });

    it('ignores failures while the client reconnect flow owns recovery', async () => {
      const { deps, mocks } = createDeps({
        isClientReconnecting: jest.fn().mockReturnValue(true),
      });
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.notifyIceFailure('failed');
      await flush();

      expect(mocks.restartIce).not.toHaveBeenCalled();
      expect(coordinator.isRecoveryActive).toBe(false);
    });

    it('skips an episode when ICE is already connected again', async () => {
      const { deps, mocks } = createDeps({
        getPeerIceState: jest.fn().mockReturnValue('connected'),
      });
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.notifyIceFailure('failed');
      await flush();

      expect(mocks.sendSignalingProbe).not.toHaveBeenCalled();
      expect(mocks.restartIce).not.toHaveBeenCalled();
      expect(coordinator.isRecoveryActive).toBe(false);
    });
  });

  describe('manual testing trigger', () => {
    it('exercises ICE restart on a healthy connected call', async () => {
      const { deps, mocks } = createDeps({
        getPeerIceState: jest.fn().mockReturnValue('connected'),
        ...FRESH_SIGNALING,
      });
      const coordinator = new SignalingHealthMonitor(deps);

      const started = coordinator.simulateIceFailureForTesting();
      await flush();

      expect(started).toBe(true);
      expect(mocks.sendSignalingProbe).not.toHaveBeenCalled();
      expect(mocks.restartIce).toHaveBeenCalledTimes(1);
      expect(mocks.sendUpdateMedia).toHaveBeenCalledWith('offer-sdp');
      expect(mocks.applyRemoteAnswer).toHaveBeenCalledWith('answer-sdp');
      expect(coordinator.state).toBe('verifyingMedia');
    });

    it('rejects the trigger when the call is not active', async () => {
      const { deps, mocks } = createDeps({ callState: jest.fn().mockReturnValue('held') });
      const coordinator = new SignalingHealthMonitor(deps);

      const started = coordinator.simulateIceFailureForTesting();
      await flush();

      expect(started).toBe(false);
      expect(mocks.restartIce).not.toHaveBeenCalled();
      expect(coordinator.isRecoveryActive).toBe(false);
    });
  });

  describe('duplicate suppression and debounce', () => {
    it('suppresses duplicate failure callbacks within one episode', async () => {
      const { deps, mocks } = createDeps();
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.notifyIceFailure('failed');
      coordinator.notifyIceFailure('failed');
      await flush();

      expect(mocks.sendSignalingProbe).toHaveBeenCalledTimes(1);
      expect(coordinator.generation).toBe(1);
    });

    it('cancels a transient disconnect inside the debounce window', async () => {
      const { deps, mocks } = createDeps();
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.notifyIceFailure('disconnected');
      jest.advanceTimersByTime(DEBOUNCE_MS - 100);
      await flush();
      coordinator.notifyIceConnected();
      jest.advanceTimersByTime(DEBOUNCE_MS + 100);
      await flush();

      expect(mocks.sendSignalingProbe).not.toHaveBeenCalled();
      expect(mocks.restartIce).not.toHaveBeenCalled();
    });

    it('starts an episode after the debounce window when ICE stays broken', async () => {
      const { deps, mocks } = createDeps();
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.notifyIceFailure('disconnected');
      jest.advanceTimersByTime(DEBOUNCE_MS);
      await flush();

      expect(mocks.sendSignalingProbe).toHaveBeenCalledTimes(1);
      expect(coordinator.isRecoveryActive).toBe(true);
    });
  });

  describe('peer connection state (iOS peerConnectionStateDidChange parity)', () => {
    it('recovers on peer connection failure even while ICE reports connected', async () => {
      const { deps, mocks } = createDeps({
        getPeerIceState: jest.fn().mockReturnValue('connected'),
        getPeerConnectionState: jest.fn().mockReturnValue('failed'),
      });
      const monitor = new SignalingHealthMonitor(deps);

      monitor.notifyPeerConnectionStateChange('failed');
      await flush();

      expect(mocks.sendSignalingProbe).toHaveBeenCalledTimes(1);
      expect(mocks.restartIce).toHaveBeenCalledTimes(1);
    });

    it('falls back when the peer connection fails during media verification', async () => {
      const { deps, mocks } = createDeps({ ...FRESH_SIGNALING });
      const monitor = new SignalingHealthMonitor(deps);

      monitor.notifyIceFailure('failed');
      await flush();
      expect(monitor.state).toBe('verifyingMedia');

      monitor.notifyPeerConnectionStateChange('failed');
      await flush();

      expect(mocks.performReattachFallback).toHaveBeenCalledTimes(1);
    });

    it('starts recovery once the peer connection stays disconnected past the delay', async () => {
      const { deps, mocks } = createDeps({
        getPeerIceState: jest.fn().mockReturnValue('connected'),
        getPeerConnectionState: jest.fn().mockReturnValue('disconnected'),
      });
      const monitor = new SignalingHealthMonitor(deps);

      monitor.notifyPeerConnectionStateChange('disconnected');
      jest.advanceTimersByTime(DEBOUNCE_MS - 1);
      await flush();
      expect(mocks.sendSignalingProbe).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      await flush();
      expect(mocks.sendSignalingProbe).toHaveBeenCalledTimes(1);
    });

    it('cancels the disconnected delay when the peer connection reconnects', async () => {
      const { deps, mocks } = createDeps({
        getPeerIceState: jest.fn().mockReturnValue('connected'),
        getPeerConnectionState: jest.fn().mockReturnValue('disconnected'),
      });
      const monitor = new SignalingHealthMonitor(deps);

      monitor.notifyPeerConnectionStateChange('disconnected');
      monitor.notifyPeerConnectionStateChange('connected');
      jest.advanceTimersByTime(DEBOUNCE_MS);
      await flush();

      expect(mocks.sendSignalingProbe).not.toHaveBeenCalled();
    });

    it('skips recovery when the peer connection is connected again when the delay fires', async () => {
      const { deps, mocks } = createDeps({
        getPeerConnectionState: jest.fn().mockReturnValue('connected'),
      });
      const monitor = new SignalingHealthMonitor(deps);

      monitor.notifyPeerConnectionStateChange('disconnected');
      jest.advanceTimersByTime(DEBOUNCE_MS);
      await flush();

      expect(mocks.sendSignalingProbe).not.toHaveBeenCalled();
    });

    it('does not let ICE connected cancel a peer-connection disconnected delay', async () => {
      const { deps, mocks } = createDeps({
        getPeerIceState: jest.fn().mockReturnValue('connected'),
        getPeerConnectionState: jest.fn().mockReturnValue('disconnected'),
      });
      const monitor = new SignalingHealthMonitor(deps);

      monitor.notifyPeerConnectionStateChange('disconnected');
      monitor.notifyIceConnected();
      jest.advanceTimersByTime(DEBOUNCE_MS);
      await flush();

      expect(mocks.sendSignalingProbe).toHaveBeenCalledTimes(1);
    });

    it('does not let ICE connected cancel a peer-connection failure episode', async () => {
      const { deps, mocks } = createDeps({
        getPeerIceState: jest.fn().mockReturnValue('connected'),
        sendSignalingProbe: jest.fn().mockReturnValue(new Promise(() => {})),
      });
      const monitor = new SignalingHealthMonitor(deps);

      monitor.notifyPeerConnectionStateChange('failed');
      await flush();
      expect(monitor.state).toBe('probing');

      monitor.notifyIceConnected();
      expect(monitor.state).toBe('probing');
      expect(mocks.sendSignalingProbe).toHaveBeenCalledTimes(1);
    });

    it('cancel clears a pending peer-connection disconnected delay', async () => {
      const { deps, mocks } = createDeps({
        getPeerConnectionState: jest.fn().mockReturnValue('disconnected'),
      });
      const monitor = new SignalingHealthMonitor(deps);

      monitor.notifyPeerConnectionStateChange('disconnected');
      monitor.cancel('call-state:ended');
      jest.advanceTimersByTime(DEBOUNCE_MS);
      await flush();

      expect(mocks.sendSignalingProbe).not.toHaveBeenCalled();
    });
  });

  describe('active-call signaling health', () => {
    it('probes stale signaling even when ICE is still connected', async () => {
      const { deps, mocks } = createDeps({
        ...STALE_SIGNALING,
        getPeerIceState: jest.fn().mockReturnValue('connected'),
        sendSignalingProbe: jest.fn().mockResolvedValue('error' as const),
      });
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.checkSignalingHealth();
      await flush();

      expect(mocks.sendSignalingProbe).toHaveBeenCalledTimes(1);
      expect(mocks.performReattachFallback).toHaveBeenCalledTimes(1);
      // Signaling failures never carry a relay override (iOS parity).
      expect(mocks.getSelectedCandidateEvidence).not.toHaveBeenCalled();
      expect(mocks.onCandidateEvidenceCaptured).not.toHaveBeenCalled();
    });

    it.each([
      ['inbound', 19_999, 44_999, false],
      ['inbound', 20_000, 44_999, true],
      ['confirmed outbound', 19_999, 45_000, true],
    ])(
      'applies the iOS %s staleness threshold (%dms inbound, %dms confirmed)',
      async (_leg, inboundIdleMs, confirmedIdleMs, shouldProbe) => {
        const { deps, mocks } = createDeps({
          inboundSignalingIdleMs: jest.fn().mockReturnValue(inboundIdleMs),
          confirmedOutboundIdleMs: jest.fn().mockReturnValue(confirmedIdleMs),
        });
        const coordinator = new SignalingHealthMonitor(deps);

        coordinator.checkSignalingHealth();
        await flush();

        expect(mocks.sendSignalingProbe).toHaveBeenCalledTimes(shouldProbe ? 1 : 0);
      }
    );

    it('reattaches immediately without probing when the socket is unavailable', async () => {
      const { deps, mocks } = createDeps({
        isSignalingAvailable: jest.fn().mockReturnValue(false),
        getPeerIceState: jest.fn().mockReturnValue('connected'),
      });
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.checkSignalingHealth();
      expect(coordinator.state).toBe('reattaching');
      await flush();

      expect(mocks.sendSignalingProbe).not.toHaveBeenCalled();
      expect(mocks.performReattachFallback).toHaveBeenCalledTimes(1);
      expect(mocks.getSelectedCandidateEvidence).not.toHaveBeenCalled();
    });

    it('ignores the health check on non-active calls and while recovery runs', async () => {
      const { deps, mocks } = createDeps({ ...STALE_SIGNALING });
      const coordinator = new SignalingHealthMonitor(deps);

      mocks.callState.mockReturnValue('held');
      coordinator.checkSignalingHealth();
      await flush();
      expect(mocks.sendSignalingProbe).not.toHaveBeenCalled();

      mocks.callState.mockReturnValue('active');
      mocks.sendSignalingProbe.mockReturnValue(new Promise(() => {}));
      coordinator.checkSignalingHealth();
      coordinator.checkSignalingHealth();
      await flush();
      expect(mocks.sendSignalingProbe).toHaveBeenCalledTimes(1);
    });

    it('honors config overrides for the staleness thresholds', async () => {
      const { deps, mocks } = createDeps({
        inboundSignalingIdleMs: jest.fn().mockReturnValue(10_000),
        config: { staleInboundActivityThresholdMs: 10_000 },
      });
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.checkSignalingHealth();
      await flush();

      expect(mocks.sendSignalingProbe).toHaveBeenCalledTimes(1);
    });

    it('returns to idle after a successful periodic health probe without restarting ICE', async () => {
      const { deps, mocks } = createDeps({
        ...STALE_SIGNALING,
        getPeerIceState: jest.fn().mockReturnValue('connected'),
        sendSignalingProbe: jest.fn().mockResolvedValue('ok' as const),
      });
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.checkSignalingHealth();
      await flush();

      expect(mocks.sendSignalingProbe).toHaveBeenCalledTimes(1);
      expect(mocks.restartIce).not.toHaveBeenCalled();
      expect(mocks.performReattachFallback).not.toHaveBeenCalled();
      expect(coordinator.isRecoveryActive).toBe(false);
    });
  });

  describe('probe correlation', () => {
    it('skips the probe when signaling is fresh', async () => {
      const { deps, mocks } = createDeps({ ...FRESH_SIGNALING });
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.notifyIceFailure('failed');
      await flush();

      expect(mocks.sendSignalingProbe).not.toHaveBeenCalled();
      expect(mocks.restartIce).toHaveBeenCalledTimes(1);
    });

    it('restarts media after a correlated probe answers', async () => {
      const { deps, mocks } = createDeps();
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.notifyIceFailure('failed');
      await flush();

      expect(mocks.sendSignalingProbe).toHaveBeenCalledTimes(1);
      expect(mocks.restartIce).toHaveBeenCalledTimes(1);
      expect(mocks.sendUpdateMedia).toHaveBeenCalledWith('offer-sdp');
      expect(mocks.applyRemoteAnswer).toHaveBeenCalledWith('answer-sdp');
      // Verification pending until RTP grows
      expect(mocks.onRecovered).not.toHaveBeenCalled();
    });

    it('falls back to reattach when the probe times out', async () => {
      const evidence = { localNetworkType: 'vpn', localCandidateType: 'relay' };
      const { deps, mocks } = createDeps({
        sendSignalingProbe: jest.fn().mockReturnValue(new Promise(() => {})),
        getSelectedCandidateEvidence: jest.fn().mockReturnValue(evidence),
      });
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.notifyIceFailure('failed');
      await flush();
      expect(mocks.performReattachFallback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(PROBE_TIMEOUT_MS);
      await flush();

      expect(mocks.performReattachFallback).toHaveBeenCalledTimes(1);
      expect(mocks.onCandidateEvidenceCaptured).toHaveBeenCalledWith(evidence);
      expect(mocks.restartIce).not.toHaveBeenCalled();
      expect(mocks.onRecoveryFailed).toHaveBeenCalledTimes(1);
    });

    it('reattaches without probing when ICE fails and the socket is unavailable', async () => {
      const evidence = { localNetworkType: 'vpn', localCandidateType: 'host' };
      const { deps, mocks } = createDeps({
        isSignalingAvailable: jest.fn().mockReturnValue(false),
        getSelectedCandidateEvidence: jest.fn().mockReturnValue(evidence),
      });
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.notifyIceFailure('failed');
      await flush();

      expect(mocks.sendSignalingProbe).not.toHaveBeenCalled();
      expect(mocks.restartIce).not.toHaveBeenCalled();
      expect(mocks.performReattachFallback).toHaveBeenCalledTimes(1);
      // Media-failure episodes still evaluate the relay override.
      expect(mocks.onCandidateEvidenceCaptured).toHaveBeenCalledWith(evidence);
    });

    it('falls back to reattach when the probe errors', async () => {
      const { deps, mocks } = createDeps({
        sendSignalingProbe: jest.fn().mockResolvedValue('error' as const),
      });
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.notifyIceFailure('failed');
      await flush();

      expect(mocks.performReattachFallback).toHaveBeenCalledTimes(1);
      expect(mocks.restartIce).not.toHaveBeenCalled();
      expect(mocks.onRecoveryFailed).toHaveBeenCalledTimes(1);
    });
  });

  describe('ICE restart exchange', () => {
    it('applies the restart answer and succeeds on RTP growth', async () => {
      const { deps, mocks } = createDeps({ ...FRESH_SIGNALING });
      let pollCount = 0;
      mocks.getInboundAudioPackets.mockImplementation(async () => {
        pollCount += 1;
        return pollCount === 1 ? 100 : 105;
      });
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.notifyIceFailure('failed');
      await flush();

      jest.advanceTimersByTime(VERIFY_POLL_MS);
      await flush();
      expect(mocks.onRecovered).not.toHaveBeenCalled();

      jest.advanceTimersByTime(VERIFY_POLL_MS);
      await flush();
      expect(mocks.onRecovered).toHaveBeenCalledTimes(1);
      expect(mocks.onRecoveryFailed).not.toHaveBeenCalled();
      expect(coordinator.isRecoveryActive).toBe(false);
    });

    it('falls back when the updateMedia exchange fails', async () => {
      const { deps, mocks } = createDeps({ ...FRESH_SIGNALING });
      mocks.sendUpdateMedia.mockRejectedValue(new Error('updateMedia rejected'));
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.notifyIceFailure('failed');
      await flush();

      expect(mocks.performReattachFallback).toHaveBeenCalledTimes(1);
      expect(mocks.onRecoveryFailed).toHaveBeenCalledTimes(1);
    });

    it('falls back when applying the restart answer fails', async () => {
      const { deps, mocks } = createDeps({ ...FRESH_SIGNALING });
      mocks.applyRemoteAnswer.mockRejectedValue(new Error('remote answer rejected'));
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.notifyIceFailure('failed');
      await flush();

      expect(mocks.performReattachFallback).toHaveBeenCalledTimes(1);
      expect(mocks.onRecovered).not.toHaveBeenCalled();
      expect(mocks.onRecoveryFailed).toHaveBeenCalledTimes(1);
    });

    it('verifies instead of falling back when ICE reconnected before the restart timeout', async () => {
      const { deps, mocks } = createDeps({ ...FRESH_SIGNALING });
      mocks.restartIce.mockReturnValue(new Promise(() => {}));
      // ICE is broken when the episode starts and has reconnected by the
      // time the restart timeout fires: first read happens at episode
      // start, second at the restart-timeout recheck.
      mocks.getPeerIceState.mockReturnValueOnce('disconnected').mockReturnValue('connected');
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.notifyIceFailure('failed');
      await flush();

      jest.advanceTimersByTime(RESTART_TIMEOUT_MS);
      await flush();

      expect(mocks.performReattachFallback).not.toHaveBeenCalled();
      expect(mocks.getInboundAudioPackets).toHaveBeenCalled();
    });

    it('falls back when the restart times out and ICE is still broken', async () => {
      const { deps, mocks } = createDeps({ ...FRESH_SIGNALING });
      mocks.restartIce.mockReturnValue(new Promise(() => {}));
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.notifyIceFailure('failed');
      await flush();

      jest.advanceTimersByTime(RESTART_TIMEOUT_MS);
      await flush();

      expect(mocks.performReattachFallback).toHaveBeenCalledTimes(1);
      expect(mocks.onRecoveryFailed).toHaveBeenCalledTimes(1);
    });
  });

  describe('RTP verification', () => {
    it('falls back when inbound RTP never grows within the window', async () => {
      const { deps, mocks } = createDeps({ ...FRESH_SIGNALING });
      mocks.getInboundAudioPackets.mockResolvedValue(100);
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.notifyIceFailure('failed');
      await flush();

      jest.advanceTimersByTime(VERIFY_WINDOW_MS);
      await flush();

      expect(mocks.performReattachFallback).toHaveBeenCalledTimes(1);
      expect(mocks.onRecovered).not.toHaveBeenCalled();
    });

    it('falls back when the packet counter is unavailable (reports disabled)', async () => {
      const { deps, mocks } = createDeps({ ...FRESH_SIGNALING });
      mocks.getInboundAudioPackets.mockResolvedValue(null);
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.notifyIceFailure('failed');
      await flush();

      jest.advanceTimersByTime(VERIFY_WINDOW_MS);
      await flush();

      expect(mocks.performReattachFallback).toHaveBeenCalledTimes(1);
    });

    it('falls back immediately when ICE fails again during verification', async () => {
      const { deps, mocks } = createDeps({ ...FRESH_SIGNALING });
      mocks.getInboundAudioPackets.mockResolvedValue(100);
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.notifyIceFailure('failed');
      await flush();
      expect(mocks.performReattachFallback).not.toHaveBeenCalled();

      coordinator.notifyIceFailure('failed');
      await flush();

      expect(mocks.performReattachFallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('reattach fallback', () => {
    it('reports recovery success when the fallback reattaches', async () => {
      const { deps, mocks } = createDeps({
        sendSignalingProbe: jest.fn().mockResolvedValue('error' as const),
        performReattachFallback: jest.fn().mockResolvedValue(true),
      });
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.notifyIceFailure('failed');
      await flush();

      expect(mocks.performReattachFallback).toHaveBeenCalledTimes(1);
      expect(mocks.onRecovered).toHaveBeenCalledTimes(1);
      expect(mocks.onRecoveryFailed).not.toHaveBeenCalled();
      expect(coordinator.isRecoveryActive).toBe(false);
    });

    it('treats a thrown fallback as a failed attempt', async () => {
      const { deps, mocks } = createDeps({
        sendSignalingProbe: jest.fn().mockResolvedValue('error' as const),
        performReattachFallback: jest.fn().mockRejectedValue(new Error('connect failed')),
      });
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.notifyIceFailure('failed');
      await flush();

      expect(mocks.onRecoveryFailed).toHaveBeenCalledTimes(1);
      expect(mocks.onRecovered).not.toHaveBeenCalled();
      expect(coordinator.isRecoveryActive).toBe(false);
    });

    it('runs only one fallback attempt per episode', async () => {
      const { deps, mocks } = createDeps({
        sendSignalingProbe: jest.fn().mockResolvedValue('error' as const),
      });
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.notifyIceFailure('failed');
      await flush();

      coordinator.notifyIceFailure('failed');
      await flush();

      expect(mocks.performReattachFallback).toHaveBeenCalledTimes(1);
      expect(mocks.onRecoveryFailed).toHaveBeenCalledTimes(1);
    });
    it('does not reattach if recovery is cancelled while candidate evidence is pending', async () => {
      let resolveEvidence: (value: any) => void = () => {};
      const { deps, mocks } = createDeps({
        sendSignalingProbe: jest.fn().mockResolvedValue('error' as const),
        getSelectedCandidateEvidence: jest.fn().mockReturnValue(
          new Promise((resolve) => {
            resolveEvidence = resolve;
          })
        ),
      });
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.notifyIceFailure('failed');
      await flush();
      expect(coordinator.state).toBe('reattaching');

      coordinator.cancel('call-state:ended');
      resolveEvidence({ localNetworkType: 'vpn', localCandidateType: 'relay' });
      await flush();

      expect(mocks.onCandidateEvidenceCaptured).not.toHaveBeenCalled();
      expect(mocks.performReattachFallback).not.toHaveBeenCalled();
      expect(mocks.onRecoveryFailed).not.toHaveBeenCalled();
      expect(coordinator.isRecoveryActive).toBe(false);
    });
  });

  describe('cancel and stale continuations', () => {
    it('explicit disconnect during a pending probe never runs reattach', async () => {
      let resolveProbe: (value: 'ok' | 'timeout' | 'error') => void = () => {};
      const { deps, mocks } = createDeps({
        ...STALE_SIGNALING,
        sendSignalingProbe: jest.fn().mockReturnValue(
          new Promise((resolve) => {
            resolveProbe = resolve;
          })
        ),
      });
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.checkSignalingHealth();
      await flush();
      expect(coordinator.state).toBe('probing');

      coordinator.cancel('client-disconnect');
      resolveProbe('error');
      await flush();

      expect(mocks.performReattachFallback).not.toHaveBeenCalled();
      expect(mocks.restartIce).not.toHaveBeenCalled();
      expect(coordinator.isRecoveryActive).toBe(false);
    });

    it('cancels pending timers and invalidates stale restart continuations', async () => {
      const { deps, mocks } = createDeps({ ...FRESH_SIGNALING });
      let resolveRestart: (sdp: string) => void = () => {};
      mocks.restartIce.mockReturnValue(
        new Promise<string>((resolve) => {
          resolveRestart = resolve;
        })
      );
      const coordinator = new SignalingHealthMonitor(deps);

      coordinator.notifyIceFailure('failed');
      await flush();
      expect(coordinator.isRecoveryActive).toBe(true);

      coordinator.cancel('call-state:ended');
      expect(coordinator.isRecoveryActive).toBe(false);

      // The stale exchange completes after cancel: nothing further happens.
      jest.advanceTimersByTime(RESTART_TIMEOUT_MS + VERIFY_WINDOW_MS);
      await flush();
      resolveRestart('late-offer');
      await flush();

      expect(mocks.sendUpdateMedia).not.toHaveBeenCalled();
      expect(mocks.applyRemoteAnswer).not.toHaveBeenCalled();
      expect(mocks.performReattachFallback).not.toHaveBeenCalled();
    });

    it('concurrent calls keep independent monitors', async () => {
      const { deps: depsA, mocks: mocksA } = createDeps();
      const { deps: depsB, mocks: mocksB } = createDeps();
      const a = new SignalingHealthMonitor(depsA);
      const b = new SignalingHealthMonitor(depsB);

      a.notifyIceFailure('failed');
      b.notifyIceFailure('failed');
      await flush();

      expect(mocksA.sendSignalingProbe).toHaveBeenCalledTimes(1);
      expect(mocksB.sendSignalingProbe).toHaveBeenCalledTimes(1);
      expect(a.generation).toBe(1);
      expect(b.generation).toBe(1);

      a.cancel('call-state:ended');
      expect(a.isRecoveryActive).toBe(false);
      expect(b.isRecoveryActive).toBe(true);
    });
  });
});
