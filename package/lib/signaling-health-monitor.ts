import log from 'loglevel';

/**
 * Per-call signaling-health and ICE-recovery monitor.
 *
 * Mirrors the iOS `SignalingHealthMonitor` ownership model (VSDK-679): this
 * class owns signaling freshness thresholds, the periodic signaling health
 * decision, probe handling, recovery state, and deadlines; `Call`/`Peer` own
 * WebRTC renegotiation; and `TelnyxRTC` owns reconnect/reattach and drives
 * the periodic `checkSignalingHealth()` tick.
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

export type SignalingHealthMonitorState =
  | 'idle'
  | 'probing'
  | 'iceRestarting'
  | 'verifyingMedia'
  | 'reattaching';

export type RecoveryFailureKind = 'failed' | 'disconnected';
/** Which peer callback reported the failure that started an episode. */
type RecoveryFailureSource = 'ice' | 'peerConnection';
type SignalingProbePurpose = 'mediaRecovery' | 'healthCheck';

/**
 * Snapshot of the selected ICE candidate pair captured when media failed.
 * Used to decide whether a relay-only one-shot override should be carried
 * into the replacement call. Evidence is intentionally narrow: only an
 * explicit VPN report from the stats snapshot qualifies. Without evidence
 * we fail closed and do not alter transport policy.
 */
export type CandidateEvidence = {
  callId?: string;
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

/**
 * Timing configuration. Defaults match the iOS `SignalingHealthMonitor`
 * initializer (converted to milliseconds).
 */
export type SignalingHealthMonitorConfig = {
  iceRestartTimeoutMs: number;
  signalingProbeTimeoutMs: number;
  /** Inbound signaling at most this old permits an immediate ICE restart. */
  recentInboundActivityThresholdMs: number;
  /** Confirmed request/response at most this old counts as recent / not stale. */
  confirmedOutboundActivityThresholdMs: number;
  /** Inbound signaling at least this old is stale for the periodic health check. */
  staleInboundActivityThresholdMs: number;
  signalingHealthCheckIntervalMs: number;
  postIceRestartMediaTimeoutMs: number;
  postIceRestartMediaPollMs: number;
  peerDisconnectedRecoveryDelayMs: number;
};

export const DEFAULT_SIGNALING_HEALTH_MONITOR_CONFIG: Readonly<SignalingHealthMonitorConfig> =
  Object.freeze({
    iceRestartTimeoutMs: 15_000,
    signalingProbeTimeoutMs: 5_000,
    recentInboundActivityThresholdMs: 3_000,
    confirmedOutboundActivityThresholdMs: 45_000,
    staleInboundActivityThresholdMs: 20_000,
    signalingHealthCheckIntervalMs: 3_000,
    postIceRestartMediaTimeoutMs: 5_000,
    postIceRestartMediaPollMs: 1_000,
    peerDisconnectedRecoveryDelayMs: 3_000,
  });

export type SignalingHealthMonitorDeps = {
  callId: string;

  /** Current call state; recovery only monitors calls in 'active'. */
  callState(): string;

  /** True when the signaling socket is currently connected. */
  isSignalingAvailable(): boolean;

  /** Milliseconds since the last inbound signaling frame (Infinity if none). */
  inboundSignalingIdleMs(): number;

  /** Milliseconds since an inbound frame last answered a request (Infinity if none). */
  confirmedOutboundIdleMs(): number;

  /** True while the client-level reconnect flow is running. */
  isClientReconnecting(): boolean;

  /**
   * Send one uniquely correlated signaling probe (telnyx_rtc.ping).
   * Resolution is correlated by request id; unrelated socket traffic must
   * not satisfy it. Returns 'ok' when the gateway answered this request with
   * either a result or an error: like iOS, any correlated response proves
   * the signaling path is alive.
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

  /** Current peer connection state of the live peer, or null when disposed. */
  getPeerConnectionState(): string | null;

  /** Selected candidate pair evidence captured from stats, if available. */
  getSelectedCandidateEvidence(): CandidateEvidence | null | Promise<CandidateEvidence | null>;

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

  config?: Partial<SignalingHealthMonitorConfig>;
  logger?: RecoveryLogger;
  now?(): number;
  scheduleTimer?(callback: () => void, ms: number): unknown;
  cancelTimer?(handle: unknown): void;
};

const CONNECTED_ICE_STATES = new Set(['connected', 'completed']);

function defaultLogger(callId: string): RecoveryLogger {
  return {
    debug: (message, context) =>
      log.debug(`[SignalingHealthMonitor:${callId}] ${message}`, context ?? ''),
    info: (message, context) =>
      log.info(`[SignalingHealthMonitor:${callId}] ${message}`, context ?? ''),
    warn: (message, context) =>
      log.warn(`[SignalingHealthMonitor:${callId}] ${message}`, context ?? ''),
    error: (message, context) =>
      log.error(`[SignalingHealthMonitor:${callId}] ${message}`, context ?? ''),
  };
}

export class SignalingHealthMonitor {
  private deps: SignalingHealthMonitorDeps;
  private config: SignalingHealthMonitorConfig;
  private logger: RecoveryLogger;

  private currentState: SignalingHealthMonitorState = 'idle';
  private currentGeneration = 0;
  private debounceHandle: unknown = null;
  private peerDisconnectedHandle: unknown = null;
  private episodeSource: RecoveryFailureSource | null = null;
  private restartTimeoutHandle: unknown = null;
  private verifyPollHandle: unknown = null;
  private verifyDeadlineHandle: unknown = null;
  private verifyBaseline: number | null = null;
  private recoveryFailedLatch = false;
  /**
   * Media-failure episodes may carry a relay override into the replacement
   * call; signaling health-check episodes never do (iOS
   * `shouldEvaluateRelayFallback`).
   */
  private shouldEvaluateRelayFallback = false;

  constructor(deps: SignalingHealthMonitorDeps) {
    this.deps = deps;
    this.config = { ...DEFAULT_SIGNALING_HEALTH_MONITOR_CONFIG, ...deps.config };
    this.logger = deps.logger ?? defaultLogger(deps.callId);
  }

  public get state(): SignalingHealthMonitorState {
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
   * Inject an ICE failure for demo-app/manual testing.
   *
   * Unlike a real ICE callback, this deliberately bypasses the
   * already-connected guard so a healthy active call can exercise the same
   * signaling probe, ICE restart, SDP exchange, and RTP verification path.
   * Production recovery still enters through notifyIceFailure().
   */
  public simulateIceFailureForTesting(): boolean {
    if (
      this.deps.callState() !== 'active' ||
      this.deps.isClientReconnecting() ||
      this.currentState !== 'idle'
    ) {
      return false;
    }

    if (this.debounceHandle != null) {
      this.cancelTimer(this.debounceHandle);
      this.debounceHandle = null;
    }
    this.cancelPeerDisconnectedRecovery();

    this.recoveryFailedLatch = false;
    this.currentGeneration += 1;
    this.currentState = 'probing';
    this.episodeSource = 'ice';
    this.shouldEvaluateRelayFallback = true;
    this.logger.info('Test ICE failure injected', { generation: this.currentGeneration });
    this.beginMediaRecovery('test ICE failure');

    return true;
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
   * or the monitor is cancelled: one recovery attempt per failure
   * period.
   *
   * Failures on non-active calls or while the client reconnect flow owns
   * recovery are ignored.
   */
  public notifyIceFailure(kind: RecoveryFailureKind): void {
    if (!this.canStartFailureEpisode('ice')) {
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
        this.startEpisode('disconnected', 'ice');
      }, this.config.peerDisconnectedRecoveryDelayMs);
      return;
    }

    this.startEpisode('failed', 'ice');
  }

  /**
   * Observe an `RTCPeerConnection.connectionState` change (iOS
   * `peerConnectionStateDidChange`). A peer-connection failure is definitive
   * even while ICE still reports connected (for example a DTLS failure), so
   * these episodes bypass the ICE already-connected guard.
   *
   * - 'failed' starts recovery immediately
   * - 'disconnected' starts recovery once the peer connection has stayed
   *   disconnected for `peerDisconnectedRecoveryDelayMs`
   * - 'connected' cancels a pending disconnected delay
   */
  public notifyPeerConnectionStateChange(state: string): void {
    switch (state) {
      case 'failed':
        this.cancelPeerDisconnectedRecovery();
        if (this.canStartFailureEpisode('peerConnection')) {
          this.startEpisode('failed', 'peerConnection');
        }
        return;
      case 'disconnected':
        this.startPeerDisconnectedRecoveryDelay();
        return;
      case 'connected':
        this.recoveryFailedLatch = false;
        this.cancelPeerDisconnectedRecovery();
        return;
      default:
        return;
    }
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
    if (this.currentState === 'probing' && this.episodeSource === 'ice') {
      // A peer-connection episode is not cleared by ICE: ICE can report
      // connected while the peer connection itself has failed.
      this.cancel('ice-recovered-before-restart');
    }
  }

  /**
   * Periodic active-call signaling health check (iOS `checkSignalingHealth`).
   * Driven by the client every `signalingHealthCheckIntervalMs` while calls
   * are active. This intentionally bypasses the connected-ICE guard used by
   * ICE-triggered episodes: media can stay connected while the WebSocket is
   * silently dead, so signaling is judged independently.
   *
   * - socket unavailable: reattach immediately
   * - inbound idle >= 20s or confirmed request/response idle >= 45s: probe;
   *   an answered probe returns to idle, an unanswered one reattaches
   */
  public checkSignalingHealth(): void {
    if (this.deps.callState() !== 'active' || this.deps.isClientReconnecting()) {
      return;
    }
    if (this.currentState !== 'idle' || this.recoveryFailedLatch) {
      return;
    }

    if (!this.deps.isSignalingAvailable()) {
      this.currentGeneration += 1;
      this.shouldEvaluateRelayFallback = false;
      this.logger.warn('Signaling socket is unavailable during an active call', {
        generation: this.currentGeneration,
      });
      void this.performFallback('active-call-signaling-unavailable');
      return;
    }

    if (!this.isSignalingStale()) {
      return;
    }

    this.currentGeneration += 1;
    this.currentState = 'probing';
    this.shouldEvaluateRelayFallback = false;
    this.logger.warn('Signaling activity is stale during an active call; probing', {
      generation: this.currentGeneration,
    });
    void this.runProbe('healthCheck');
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
    this.cancelPeerDisconnectedRecovery();
    this.clearRestartTimeout();
    this.clearVerifyTimers();

    if (this.currentState !== 'idle') {
      this.logger.info('Recovery cancelled', { reason, state: this.currentState });
    }
    this.recoveryFailedLatch = false;
    this.shouldEvaluateRelayFallback = false;
    this.episodeSource = null;
    this.currentGeneration += 1;
    this.currentState = 'idle';
  }

  // --- Episode machinery ---

  /**
   * Shared guard for ICE and peer-connection failure callbacks. A failure
   * during media verification falls back immediately; any other in-flight
   * episode suppresses the duplicate.
   */
  private canStartFailureEpisode(source: RecoveryFailureSource): boolean {
    if (this.deps.callState() !== 'active' || this.deps.isClientReconnecting()) {
      return false;
    }

    if (this.currentState === 'verifyingMedia') {
      // A fresh failure while verifying means the restart did not recover
      // media; fall back immediately instead of waiting out the window.
      this.logger.warn(
        `${this.describeSource(source)} failed again during verification, falling back`
      );
      void this.performFallback(
        source === 'ice'
          ? 'ice-failed-during-verification'
          : 'peer-connection-failed-during-verification'
      );
      return false;
    }

    // Duplicate suppression: one episode at a time per call.
    return this.currentState === 'idle';
  }

  /**
   * iOS `startPeerDisconnectedRecoveryDelay`: a peer connection that stays
   * disconnected for the delay starts recovery. Only a peer-connection
   * 'connected' (or failure/cancel) clears it; ICE state does not.
   */
  private startPeerDisconnectedRecoveryDelay(): void {
    if (
      this.deps.callState() !== 'active' ||
      this.deps.isClientReconnecting() ||
      this.currentState !== 'idle'
    ) {
      return;
    }
    this.cancelPeerDisconnectedRecovery();
    const generation = this.currentGeneration;
    const delayMs = this.config.peerDisconnectedRecoveryDelayMs;
    this.logger.info('Peer connection disconnected, scheduling recovery delay');
    this.peerDisconnectedHandle = this.schedule(() => {
      this.peerDisconnectedHandle = null;
      if (generation !== this.currentGeneration) {
        return;
      }
      if (this.deps.getPeerConnectionState() === 'connected') {
        this.logger.info('Peer connection recovered before the disconnected delay elapsed');
        return;
      }
      this.logger.warn(
        `Peer connection remained disconnected for ${delayMs}ms; starting recovery`
      );
      this.startEpisode('disconnected', 'peerConnection');
    }, delayMs);
  }

  private cancelPeerDisconnectedRecovery(): void {
    if (this.peerDisconnectedHandle != null) {
      this.cancelTimer(this.peerDisconnectedHandle);
      this.peerDisconnectedHandle = null;
    }
  }

  private describeSource(source: RecoveryFailureSource): string {
    return source === 'ice' ? 'ICE' : 'Peer connection';
  }

  private startEpisode(kind: RecoveryFailureKind, source: RecoveryFailureSource): void {
    if (this.currentState !== 'idle') {
      return;
    }
    if (this.deps.callState() !== 'active' || this.deps.isClientReconnecting()) {
      return;
    }

    if (source === 'ice') {
      const iceState = this.deps.getPeerIceState();
      if (iceState && CONNECTED_ICE_STATES.has(iceState)) {
        // Already-connected guard: media re-established on its own.
        this.logger.info('ICE already connected, skipping recovery episode');
        this.recoveryFailedLatch = false;
        return;
      }
    }
    if (this.recoveryFailedLatch) {
      // One recovery attempt per failure period: after the single reattach
      // fallback failed, wait for media to demonstrably recover (ICE or the
      // peer connection seen connected again) before spending another episode.
      this.logger.info('Recovery already exhausted, waiting for media to reconnect');
      return;
    }

    this.currentGeneration += 1;
    this.currentState = 'probing';
    this.episodeSource = source;
    this.shouldEvaluateRelayFallback = true;
    this.logger.info('Recovery episode started', {
      generation: this.currentGeneration,
      kind,
      source,
    });
    this.beginMediaRecovery(`${this.describeSource(source)} ${kind}`);
  }

  /**
   * iOS `requestRecovery` decision: reattach when signaling is unavailable,
   * restart ICE immediately when signaling was recently confirmed, and
   * otherwise probe signaling before restarting.
   */
  private beginMediaRecovery(trigger: string): void {
    if (!this.deps.isSignalingAvailable()) {
      this.logger.warn(`${trigger} with signaling unavailable; starting reconnect/reattach`);
      void this.performFallback('signaling-unavailable');
      return;
    }
    if (this.hasRecentSignalingActivity()) {
      this.logger.info(`${trigger} with signaling available; starting ICE restart`);
      void this.runRestart();
      return;
    }
    this.logger.info(`${trigger} with stale signaling; probing before ICE restart`);
    void this.runProbe('mediaRecovery');
  }

  private hasRecentSignalingActivity(): boolean {
    return (
      this.deps.inboundSignalingIdleMs() <= this.config.recentInboundActivityThresholdMs &&
      this.deps.confirmedOutboundIdleMs() <= this.config.confirmedOutboundActivityThresholdMs
    );
  }

  private isSignalingStale(): boolean {
    return (
      this.deps.inboundSignalingIdleMs() >= this.config.staleInboundActivityThresholdMs ||
      this.deps.confirmedOutboundIdleMs() >= this.config.confirmedOutboundActivityThresholdMs
    );
  }

  private async runProbe(purpose: SignalingProbePurpose): Promise<void> {
    const generation = this.currentGeneration;
    this.logger.info('Sending correlated signaling ping probe', { purpose });

    const result = await this.withTimeout(
      this.deps.sendSignalingProbe(),
      this.config.signalingProbeTimeoutMs,
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

    if (purpose === 'healthCheck') {
      this.logger.info('Signaling health probe answered, recovery returning to idle');
      this.setState('idle');
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
    }, this.config.iceRestartTimeoutMs);

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
    }, this.config.postIceRestartMediaTimeoutMs);

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
        this.verifyPollHandle = this.schedule(poll, this.config.postIceRestartMediaPollMs);
      })();
    };
    this.verifyPollHandle = this.schedule(poll, this.config.postIceRestartMediaPollMs);
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

    const evaluateRelayFallback = this.shouldEvaluateRelayFallback;
    this.shouldEvaluateRelayFallback = false;
    let evidence: CandidateEvidence | null = null;
    if (evaluateRelayFallback) {
      try {
        evidence = await this.deps.getSelectedCandidateEvidence();
      } catch (error) {
        this.logger.debug('Unable to capture selected candidate evidence', {
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (
      generation !== this.currentGeneration ||
      (this.currentState as SignalingHealthMonitorState) !== 'reattaching' ||
      this.deps.callState() !== 'active'
    ) {
      return;
    }
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

  private setState(state: SignalingHealthMonitorState): void {
    if (this.currentState !== state) {
      this.logger.debug('Recovery state transition', {
        from: this.currentState,
        to: state,
        generation: this.currentGeneration,
      });
    }
    if (state === 'idle') {
      this.episodeSource = null;
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
