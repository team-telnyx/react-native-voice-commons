import { CallRecoveryCoordinator } from '../lib/call-recovery-coordinator';
import type { CallRecoveryDeps } from '../lib/call-recovery-coordinator';

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

/** Drain pending microtasks without advancing fake timers. */
async function flush(): Promise<void> {
  for (let i = 0; i < 12; i += 1) {
    await Promise.resolve();
    await Promise.resolve();
  }
}

function createDeps(overrides: Partial<CallRecoveryDeps> = {}) {
  // mocks doubles as the source of deps so that test overrides and
  // assertions always observe the same functions the coordinator invokes.
  const mocks = {
    callState: jest.fn().mockReturnValue('active'),
    isSignalingFresh: jest.fn().mockReturnValue(false),
    isClientReconnecting: jest.fn().mockReturnValue(false),
    sendSignalingProbe: jest.fn().mockResolvedValue('ok' as const),
    restartIce: jest.fn().mockResolvedValue('offer-sdp'),
    sendUpdateMedia: jest.fn().mockResolvedValue('answer-sdp'),
    applyRemoteAnswer: jest.fn().mockResolvedValue(undefined),
    getInboundAudioPackets: jest.fn().mockResolvedValue(100),
    getPeerIceState: jest.fn().mockReturnValue('disconnected'),
    getSelectedCandidateEvidence: jest.fn().mockReturnValue(null),
    performReattachFallback: jest.fn().mockResolvedValue(false),
    onCandidateEvidenceCaptured: jest.fn(),
    onRecovered: jest.fn(),
    onRecoveryFailed: jest.fn(),
  };

  Object.assign(mocks, overrides);

  const deps: CallRecoveryDeps = {
    callId: 'recovery-call-id',
    ...mocks,
  };

  return { deps, mocks };
}

describe('CallRecoveryCoordinator', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('guards', () => {
    it('ignores failures on non-active calls', async () => {
      const { deps, mocks } = createDeps({ callState: jest.fn().mockReturnValue('held') });
      const coordinator = new CallRecoveryCoordinator(deps);

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
      const coordinator = new CallRecoveryCoordinator(deps);

      coordinator.notifyIceFailure('failed');
      await flush();

      expect(mocks.restartIce).not.toHaveBeenCalled();
      expect(coordinator.isRecoveryActive).toBe(false);
    });

    it('skips an episode when ICE is already connected again', async () => {
      const { deps, mocks } = createDeps({
        getPeerIceState: jest.fn().mockReturnValue('connected'),
      });
      const coordinator = new CallRecoveryCoordinator(deps);

      coordinator.notifyIceFailure('failed');
      await flush();

      expect(mocks.sendSignalingProbe).not.toHaveBeenCalled();
      expect(mocks.restartIce).not.toHaveBeenCalled();
      expect(coordinator.isRecoveryActive).toBe(false);
    });
  });

  describe('duplicate suppression and debounce', () => {
    it('suppresses duplicate failure callbacks within one episode', async () => {
      const { deps, mocks } = createDeps();
      const coordinator = new CallRecoveryCoordinator(deps);

      coordinator.notifyIceFailure('failed');
      coordinator.notifyIceFailure('failed');
      await flush();

      expect(mocks.sendSignalingProbe).toHaveBeenCalledTimes(1);
      expect(coordinator.generation).toBe(1);
    });

    it('cancels a transient disconnect inside the debounce window', async () => {
      const { deps, mocks } = createDeps();
      const coordinator = new CallRecoveryCoordinator(deps);

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
      const coordinator = new CallRecoveryCoordinator(deps);

      coordinator.notifyIceFailure('disconnected');
      jest.advanceTimersByTime(DEBOUNCE_MS);
      await flush();

      expect(mocks.sendSignalingProbe).toHaveBeenCalledTimes(1);
      expect(coordinator.isRecoveryActive).toBe(true);
    });
  });

  describe('probe correlation', () => {
    it('skips the probe when signaling is fresh', async () => {
      const { deps, mocks } = createDeps({ isSignalingFresh: jest.fn().mockReturnValue(true) });
      const coordinator = new CallRecoveryCoordinator(deps);

      coordinator.notifyIceFailure('failed');
      await flush();

      expect(mocks.sendSignalingProbe).not.toHaveBeenCalled();
      expect(mocks.restartIce).toHaveBeenCalledTimes(1);
    });

    it('restarts media after a correlated probe answers', async () => {
      const { deps, mocks } = createDeps();
      const coordinator = new CallRecoveryCoordinator(deps);

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
      const coordinator = new CallRecoveryCoordinator(deps);

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

    it('falls back to reattach when the probe errors', async () => {
      const { deps, mocks } = createDeps({
        sendSignalingProbe: jest.fn().mockResolvedValue('error' as const),
      });
      const coordinator = new CallRecoveryCoordinator(deps);

      coordinator.notifyIceFailure('failed');
      await flush();

      expect(mocks.performReattachFallback).toHaveBeenCalledTimes(1);
      expect(mocks.restartIce).not.toHaveBeenCalled();
      expect(mocks.onRecoveryFailed).toHaveBeenCalledTimes(1);
    });
  });

  describe('ICE restart exchange', () => {
    it('applies the restart answer and succeeds on RTP growth', async () => {
      const { deps, mocks } = createDeps({ isSignalingFresh: jest.fn().mockReturnValue(true) });
      let pollCount = 0;
      mocks.getInboundAudioPackets.mockImplementation(async () => {
        pollCount += 1;
        return pollCount === 1 ? 100 : 105;
      });
      const coordinator = new CallRecoveryCoordinator(deps);

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
      const { deps, mocks } = createDeps({ isSignalingFresh: jest.fn().mockReturnValue(true) });
      mocks.sendUpdateMedia.mockRejectedValue(new Error('updateMedia rejected'));
      const coordinator = new CallRecoveryCoordinator(deps);

      coordinator.notifyIceFailure('failed');
      await flush();

      expect(mocks.performReattachFallback).toHaveBeenCalledTimes(1);
      expect(mocks.onRecoveryFailed).toHaveBeenCalledTimes(1);
    });

    it('verifies instead of falling back when ICE reconnected before the restart timeout', async () => {
      const { deps, mocks } = createDeps({ isSignalingFresh: jest.fn().mockReturnValue(true) });
      mocks.restartIce.mockReturnValue(new Promise(() => {}));
      // ICE is broken when the episode starts and has reconnected by the
      // time the restart timeout fires: first read happens at episode
      // start, second at the restart-timeout recheck.
      mocks.getPeerIceState.mockReturnValueOnce('disconnected').mockReturnValue('connected');
      const coordinator = new CallRecoveryCoordinator(deps);

      coordinator.notifyIceFailure('failed');
      await flush();

      jest.advanceTimersByTime(RESTART_TIMEOUT_MS);
      await flush();

      expect(mocks.performReattachFallback).not.toHaveBeenCalled();
      expect(mocks.getInboundAudioPackets).toHaveBeenCalled();
    });

    it('falls back when the restart times out and ICE is still broken', async () => {
      const { deps, mocks } = createDeps({ isSignalingFresh: jest.fn().mockReturnValue(true) });
      mocks.restartIce.mockReturnValue(new Promise(() => {}));
      const coordinator = new CallRecoveryCoordinator(deps);

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
      const { deps, mocks } = createDeps({ isSignalingFresh: jest.fn().mockReturnValue(true) });
      mocks.getInboundAudioPackets.mockResolvedValue(100);
      const coordinator = new CallRecoveryCoordinator(deps);

      coordinator.notifyIceFailure('failed');
      await flush();

      jest.advanceTimersByTime(VERIFY_WINDOW_MS);
      await flush();

      expect(mocks.performReattachFallback).toHaveBeenCalledTimes(1);
      expect(mocks.onRecovered).not.toHaveBeenCalled();
    });

    it('falls back when the packet counter is unavailable (reports disabled)', async () => {
      const { deps, mocks } = createDeps({ isSignalingFresh: jest.fn().mockReturnValue(true) });
      mocks.getInboundAudioPackets.mockResolvedValue(null);
      const coordinator = new CallRecoveryCoordinator(deps);

      coordinator.notifyIceFailure('failed');
      await flush();

      jest.advanceTimersByTime(VERIFY_WINDOW_MS);
      await flush();

      expect(mocks.performReattachFallback).toHaveBeenCalledTimes(1);
    });

    it('falls back immediately when ICE fails again during verification', async () => {
      const { deps, mocks } = createDeps({ isSignalingFresh: jest.fn().mockReturnValue(true) });
      mocks.getInboundAudioPackets.mockResolvedValue(100);
      const coordinator = new CallRecoveryCoordinator(deps);

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
      const coordinator = new CallRecoveryCoordinator(deps);

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
      const coordinator = new CallRecoveryCoordinator(deps);

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
      const coordinator = new CallRecoveryCoordinator(deps);

      coordinator.notifyIceFailure('failed');
      await flush();

      coordinator.notifyIceFailure('failed');
      await flush();

      expect(mocks.performReattachFallback).toHaveBeenCalledTimes(1);
      expect(mocks.onRecoveryFailed).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancel and stale continuations', () => {
    it('cancels pending timers and invalidates stale restart continuations', async () => {
      const { deps, mocks } = createDeps({ isSignalingFresh: jest.fn().mockReturnValue(true) });
      let resolveRestart: (sdp: string) => void = () => {};
      mocks.restartIce.mockReturnValue(
        new Promise<string>((resolve) => {
          resolveRestart = resolve;
        })
      );
      const coordinator = new CallRecoveryCoordinator(deps);

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

    it('concurrent calls keep independent coordinators', async () => {
      const { deps: depsA, mocks: mocksA } = createDeps();
      const { deps: depsB, mocks: mocksB } = createDeps();
      const a = new CallRecoveryCoordinator(depsA);
      const b = new CallRecoveryCoordinator(depsB);

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
