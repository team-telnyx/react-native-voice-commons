import log from 'loglevel';

/**
 * Serialized recovery coordinator for active-call ICE restart recovery.
 *
 * Maps the proven iOS/JS SDK state machine onto the existing React Native
 * call/peer/socket abstractions (VSDK-679):
 *
 *   idle ──(ICE failed / disconnected>3s)──▶ probing ──▶ iceRestarting
 *                                                        │
 *                    ┌───────────────────────────────────┤
 *                    ▼                                   ▼
 *             verifyingMedia                       reattaching
 *                    │                                   │
 *                    ├── RTP growth ──▶ idle (success)   ├── replacement call ──▶ idle
 *                    └── no growth ──▶ reattaching      └── one attempt failed ──▶ idle
 *
 * Every asynchronous continuation is scoped to the call ID plus a recovery
 * generation so a stale timer, probe, or answer can never affect a newer
 * peer. Duplicate failure events are suppressed while an episode runs.
 */

export type CallRecoveryState =
  | 'idle'
  | 'probing'
  | 'iceRestarting'
  | 'verifyingMedia'
  | 'reattaching';

export type RecoveryFailureKind = 'failed' | 'disconnected';

/**
 * Snapshot of the selected ICE candidate pair captured when media failed.
 * Used to decide whether a relay-only one-shot override should be carried
 * into the replacement call. Evidence is intentionally narrow: only an
 * explicit VPN report from the stats snapshot qualifies. Without evidence
 * we fail closed and do not alter transport policy.
 */
export type CandidateEvidence = {
  localCandidateType?: string;
  remoteCandidateType?: string;
  localNetworkType?: string;
  localAddress?: string;
  localProtocol?: string;
};

export type RecoveryLogger = {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
};

export type CallRecoveryDeps = {
  callId: string;

  /** Current call state; recovery only monitors calls in 'active'. */
  callState(): string;

  /**
   * True when inbound socket traffic was observed recently and the socket
   * claims to be connected. Fresh signaling permits an immediate restart.
   */
  isSignalingFresh(): boolean;

  /** True while the client-level reconnect flow is running. */
  isClientReconnecting(): boolean;

  /**
   * Send one uniquely correlated signaling probe (telnyx_rtc.ping).
   * Resolution is correlated by request id; unrelated socket traffic must
   * not satisfy it. Returns 'ok' when the gateway answered this request.
   */
  sendSignalingProbe(): Promise<'ok' | 'timeout' | 'error'>;

  /** Run the underlying peer restartIce and return the local offer SDP. */
  restartIce(): Promise<string>;

  /** Send telnyx_rtc.modify(action: updateMedia) and return the answer SDP. */
  sendUpdateMedia(offerSdp: string): Promise<string>;

  /** Apply the matching answer SDP to the same peer connection. */
  applyRemoteAnswer(answerSdp: string): Promise<void>;

  /** Latest inbound audio packet counter, or null when unavailable. */
  getInboundAudioPackets(): Promise<number | null>;

  /** Current ICE connection state of the live peer, or null when disposed. */
  getPeerIceState(): string | null;

  /** Selected candidate pair evidence captured from stats, if available. */
  getSelectedCandidateEvidence(): CandidateEvidence | null;

  /**
   * Client-owned fallback: one reconnect/register/reattach. Resolves true
   * when the backend attach for this call was received (replacement call
   * initiated) or false when the single attempt failed.
   */
  performReattachFallback(): Promise<boolean>;

  /** Invoked before the fallback so the client can carry a relay override. */
  onCandidateEvidenceCaptured?(evidence: CandidateEvidence): void;

  /** Invoked when the single fallback attempt failed. */
  onRecoveryFailed?(): void;

  /** Invoked when recovery completed successfully. */
  onRecovered?(): void;

  logger?: RecoveryLogger;
  now?(): number;
  scheduleTimer?(callback: () => void, ms: number): unknown;
  cancelTimer?(handle: unknown): void;
};

export const RECOVERY_DISCONNECT_DEBOUNCE_MS = 3000;
export const RECOVERY_PROBE_TIMEOUT_MS = 5000;
export const RECOVERY_RESTART_TIMEOUT_MS = 15000;
export const RECOVERY_RTP_VERIFY_WINDOW_MS = 5000;
export const RECOVERY_RTP_VERIFY_POLL_MS = 1000;

const CONNECTED_ICE_STATES = new Set(['connected', 'completed']);

function defaultLogger(callId: string): RecoveryLogger {
  return {
    debug: (message, context) =>
      log.debug(`[CallRecovery:${callId}] ${message}`, context ?? ''),
    info: (message, context) => log.info(`[CallRecovery:${callId}] ${message}`, context ?? ''),
    warn: (message, context) => log.warn(`[CallRecovery:${callId}] ${message}`, context ?? ''),
    error: (message, context) => log.error(`[CallRecovery:${callId}] ${message}`, context ?? ''),
  };
}

export class CallRecoveryCoordinator {
  private deps: CallRecoveryDeps;
  private logger: RecoveryLogger;

  private currentState: CallRecoveryState = 'idle';
  private currentGeneration = 0;
  private debounceHandle: unknown = null;
  private restartTimeoutHandle: unknown = null;
  private verifyPollHandle: unknown = null;
  private verifyDeadlineHandle: unknown = null;
  private verifyBaseline: number | null = null;
  private recoveryFailedLatch = false;

  constructor(deps: CallRecoveryDeps) {
    this.deps = deps;
    this.logger = deps.logger ?? defaultLogger(deps.callId);
  }

  public get state(): CallRecoveryState {
    return this.currentState;
  }

  /** Monotonic recovery generation; bumps at episode start and on cancel. */
  public get generation(): number {
    return this.currentGeneration;
  }

  public get isRecoveryActive(): boolean {
    return this.currentState !== 'idle';
  }

  /**
   * Observe an ICE failure on the monitored call.
   *
   * - 'failed' starts a recovery episode immediately (duplicate-suppressed).
   * - 'disconnected' waits a 3-second debounce and re-checks the live ICE
   *   state before starting; a reconnect inside the window cancels it.
   *
   * After the single reattach fallback failed, further notifications are
   * suppressed until ICE is observed connected again (notifyIceConnected)
   * or the coordinator is cancelled: one recovery attempt per failure
   * period.
   *
   * Failures on non-active calls or while the client reconnect flow owns
   * recovery are ignored.
   */
  public notifyIceFailure(kind: RecoveryFailureKind): void {
    if (this.deps.callState() !== 'active') {
      return;
    }
    if (this.deps.isClientReconnecting()) {
      return;
    }

    if (this.currentState === 'verifyingMedia') {
      // A fresh failure while verifying means the restart did not recover
      // media; fall back immediately instead of waiting out the window.
      this.logger.warn('ICE failed again during verification, falling back');
      void this.performFallback('ice-failed-during-verification');
      return;
    }

    if (this.currentState !== 'idle') {
      // Duplicate suppression: one episode at a time per call.
      return;
    }

    if (kind === 'disconnected') {
      if (this.debounceHandle != null) {
        return;
      }
      const generation = this.currentGeneration;
      this.logger.info('ICE disconnected, scheduling recovery debounce');
      this.debounceHandle = this.schedule(() => {
        this.debounceHandle = null;
        if (generation !== this.currentGeneration) {
          return;
        }
        const iceState = this.deps.getPeerIceState();
        if (iceState && CONNECTED_ICE_STATES.has(iceState)) {
          this.logger.info('Transient ICE disconnect recovered before debounce fired');
          return;
        }
        this.startEpisode('disconnected');
      }, RECOVERY_DISCONNECT_DEBOUNCE_MS);
      return;
    }

    this.startEpisode('failed');
  }

  /**
   * Observe ICE recovery. Cancels a pending transient-disconnect debounce
   * and abandons the probing phase. Active restart/verify episodes keep
   * running: the in-flight exchange and RTP verification are the arbiter.
   */
  public notifyIceConnected(): void {
    this.recoveryFailedLatch = false;
    if (this.debounceHandle != null) {
      this.cancelTimer(this.debounceHandle);
      this.debounceHandle = null;
      this.logger.info('Transient ICE disconnect cleared, debounce cancelled');
    }
    if (this.currentState === 'probing') {
      this.cancel('ice-recovered-before-restart');
    }
  }

  /**
   * Cancel all recovery work. Called for terminal calls, hangup, peer
   * disposal, client disconnect/logout, network-interface teardown, and
   * replacement-call activation. Stale async continuations are invalidated
   * by bumping the generation.
   */
  public cancel(reason: string): void {
    if (this.debounceHandle != null) {
      this.cancelTimer(this.debounceHandle);
      this.debounceHandle = null;
    }
    this.clearRestartTimeout();
    this.clearVerifyTimers();

    if (this.currentState !== 'idle') {
      this.logger.info('Recovery cancelled', { reason, state: this.currentState });
    }
    this.recoveryFailedLatch = false;
    this.currentGeneration += 1;
    this.currentState = 'idle';
  }

  // --- Episode machinery ---

  private startEpisode(kind: RecoveryFailureKind): void {
    if (this.currentState !== 'idle') {
      return;
    }
    if (this.deps.callState() !== 'active' || this.deps.isClientReconnecting()) {
      return;
    }

    const iceState = this.deps.getPeerIceState();
    if (iceState && CONNECTED_ICE_STATES.has(iceState)) {
      // Already-connected guard: media re-established on its own.
      this.logger.info('ICE already connected, skipping recovery episode');
      this.recoveryFailedLatch = false;
      return;
    }
    if (this.recoveryFailedLatch) {
      // One recovery attempt per failure period: after the single reattach
      // fallback failed, wait for media to demonstrably recover (ICE seen
      // connected again) before spending another episode.
      this.logger.info('Recovery already exhausted, waiting for ICE to reconnect');
      return;
    }

    this.currentGeneration += 1;
    this.currentState = 'probing';
    this.logger.info('Recovery episode started', { generation: this.currentGeneration, kind });

    if (this.deps.isSignalingFresh()) {
      this.logger.info('Signaling recently active, proceeding to ICE restart');
      void this.runRestart();
      return;
    }

    void this.runProbe();
  }

  private async runProbe(): Promise<void> {
    const generation = this.currentGeneration;
    this.logger.info('Signaling stale or unknown, sending correlated ping probe');

    const result = await this.withTimeout(
      this.deps.sendSignalingProbe(),
      RECOVERY_PROBE_TIMEOUT_MS,
      'timeout' as const
    ).catch(() => 'error' as const);

    if (generation !== this.currentGeneration || this.currentState !== 'probing') {
      return;
    }

    if (result !== 'ok') {
      this.logger.warn('Signaling probe did not answer, falling back to reattach', {
        result,
      });
      await this.performFallback(`signaling-probe-${result}`);
      return;
    }

    this.logger.info('Signaling probe answered, proceeding to ICE restart');
    await this.runRestart();
  }

  private async runRestart(): Promise<void> {
    const generation = this.currentGeneration;
    this.setState('iceRestarting');
    this.clearRestartTimeout();
    this.restartTimeoutHandle = this.schedule(() => {
      this.restartTimeoutHandle = null;
      if (generation !== this.currentGeneration || this.currentState !== 'iceRestarting') {
        return;
      }
      this.logger.warn('ICE restart timed out, re-checking peer state');
      const iceState = this.deps.getPeerIceState();
      if (iceState && CONNECTED_ICE_STATES.has(iceState)) {
        // The restart recovered media even without a completed answer
        // exchange; hand over to RTP verification as the final arbiter.
        void this.runVerification();
        return;
      }
      void this.performFallback('restart-timeout');
    }, RECOVERY_RESTART_TIMEOUT_MS);

    try {
      const offerSdp = await this.deps.restartIce();
      if (generation !== this.currentGeneration) {
        return;
      }
      const answerSdp = await this.deps.sendUpdateMedia(offerSdp);
      if (generation !== this.currentGeneration) {
        return;
      }
      await this.deps.applyRemoteAnswer(answerSdp);
    } catch (error) {
      if (generation !== this.currentGeneration) {
        return;
      }
      this.logger.warn('ICE restart exchange failed, falling back to reattach', {
        reason: error instanceof Error ? error.message : String(error),
      });
      await this.performFallback('restart-failed');
      return;
    }

    if (generation !== this.currentGeneration || this.currentState !== 'iceRestarting') {
      return;
    }

    await this.runVerification();
  }

  private async runVerification(): Promise<void> {
    const generation = this.currentGeneration;
    this.clearRestartTimeout();
    this.setState('verifyingMedia');

    // Sample the packet counter immediately so the window starts from a
    // known point, then poll for growth. The first poll tick is a warm-up:
    // restarted media needs a moment to produce packets, so growth is only
    // judged from the second tick onward against the starting baseline.
    let baseline: number | null = null;
    try {
      baseline = await this.deps.getInboundAudioPackets();
    } catch {
      baseline = null;
    }
    if (generation !== this.currentGeneration || this.currentState !== 'verifyingMedia') {
      return;
    }
    this.verifyBaseline = baseline;

    this.verifyDeadlineHandle = this.schedule(() => {
      this.verifyDeadlineHandle = null;
      if (generation !== this.currentGeneration || this.currentState !== 'verifyingMedia') {
        return;
      }
      this.logger.warn('No inbound RTP growth within verification window');
      void this.performFallback('no-rtp-growth');
    }, RECOVERY_RTP_VERIFY_WINDOW_MS);

    let pollsCompleted = 0;

    const poll = () => {
      this.verifyPollHandle = null;
      if (generation !== this.currentGeneration || this.currentState !== 'verifyingMedia') {
        return;
      }
      void (async () => {
        let fresh: number | null = null;
        try {
          fresh = await this.deps.getInboundAudioPackets();
        } catch {
          fresh = null;
        }
        if (generation !== this.currentGeneration || this.currentState !== 'verifyingMedia') {
          return;
        }
        pollsCompleted += 1;
        if (
          pollsCompleted > 1 &&
          fresh != null &&
          this.verifyBaseline != null &&
          fresh > this.verifyBaseline
        ) {
          this.logger.info('Inbound RTP verified, recovery succeeded');
          this.clearVerifyTimers();
          this.setState('idle');
          this.deps.onRecovered?.();
          return;
        }
        this.verifyPollHandle = this.schedule(poll, RECOVERY_RTP_VERIFY_POLL_MS);
      })();
    };
    this.verifyPollHandle = this.schedule(poll, RECOVERY_RTP_VERIFY_POLL_MS);
  }

  private async performFallback(reason: string): Promise<void> {
    if (this.currentState === 'reattaching') {
      return;
    }
    const generation = this.currentGeneration;
    this.clearRestartTimeout();
    this.clearVerifyTimers();
    this.setState('reattaching');
    this.logger.info('Falling back to reconnect/register/reattach', { reason });

    const evidence = this.deps.getSelectedCandidateEvidence();
    if (evidence && this.deps.onCandidateEvidenceCaptured) {
      this.deps.onCandidateEvidenceCaptured(evidence);
    }

    let reattached = false;
    try {
      reattached = await this.deps.performReattachFallback();
    } catch (error) {
      this.logger.warn('Reattach fallback threw', {
        reason: error instanceof Error ? error.message : String(error),
      });
      reattached = false;
    }

    if (generation !== this.currentGeneration) {
      return;
    }

    if (reattached) {
      this.logger.info('Reattach accepted by backend, replacement call initiated');
      this.setState('idle');
      this.deps.onRecovered?.();
      return;
    }

    this.logger.warn('Reattach fallback failed after one attempt');
    this.recoveryFailedLatch = true;
    this.setState('idle');
    this.deps.onRecoveryFailed?.();
  }

  // --- Helpers ---

  private setState(state: CallRecoveryState): void {
    if (this.currentState !== state) {
      this.logger.debug('Recovery state transition', {
        from: this.currentState,
        to: state,
        generation: this.currentGeneration,
      });
    }
    this.currentState = state;
  }

  private clearRestartTimeout(): void {
    if (this.restartTimeoutHandle != null) {
      this.cancelTimer(this.restartTimeoutHandle);
      this.restartTimeoutHandle = null;
    }
  }

  private clearVerifyTimers(): void {
    if (this.verifyPollHandle != null) {
      this.cancelTimer(this.verifyPollHandle);
      this.verifyPollHandle = null;
    }
    if (this.verifyDeadlineHandle != null) {
      this.cancelTimer(this.verifyDeadlineHandle);
      this.verifyDeadlineHandle = null;
    }
    this.verifyBaseline = null;
  }

  private schedule(callback: () => void, ms: number): unknown {
    if (this.deps.scheduleTimer) {
      return this.deps.scheduleTimer(callback, ms);
    }
    return setTimeout(callback, ms);
  }

  private cancelTimer(handle: unknown): void {
    if (this.deps.cancelTimer) {
      this.deps.cancelTimer(handle);
      return;
    }
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  }

  /**
   * Race a promise against an injected-timer timeout. Both paths settle at
   * most once; the loser's continuation is a no-op.
   */
  private withTimeout<T>(promise: Promise<T>, ms: number, timeoutValue: T): Promise<T> {
    let settled = false;
    let timer: unknown = null;

    return new Promise<T>((resolve, reject) => {
      const cleanup = () => {
        if (timer != null) {
          this.cancelTimer(timer);
          timer = null;
        }
      };

      promise.then(
        (value) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(value);
        },
        (error) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(error);
        }
      );

      timer = this.schedule(() => {
        if (settled) return;
        settled = true;
        resolve(timeoutValue);
      }, ms);
    });
  }
}
