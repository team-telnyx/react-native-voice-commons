import log from 'loglevel';
import uuid from 'uuid-random';
import type { Connection } from './connection';
import {
  createDebugReportStartMessage,
  createDebugReportStopMessage,
  createDebugReportDataMessage,
  createStatsEvent,
  WebRTCStatsEvent,
  WebRTCStatsTag,
  type StatsEvent,
} from './messages/debug-stats';
import type { RTCPeerConnection as RTCPeerConnectionType } from 'react-native-webrtc';

const STATS_INTERVAL_MS = 2000;
const UFRAG_LABEL = 'ufrag';
const ONE_SEC = 1000.0;

export interface WebRTCReporterOptions {
  connection: Connection;
  peerId: string;
  connectionId: string;
  peerConnection: RTCPeerConnectionType;
  iceServers?: RTCIceServer[];
}

interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/**
 * WebRTCReporter collects and sends WebRTC statistics to the Telnyx debug service.
 * This class mirrors the functionality of the Android WebRTCReporter.
 */
export class WebRTCReporter {
  private connection: Connection;
  private peerId: string;
  private connectionId: string;
  private peerConnection: RTCPeerConnectionType;
  private iceServers: RTCIceServer[];
  private debugStatsId: string;
  private debugReportStarted: boolean = false;
  private statsIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(options: WebRTCReporterOptions) {
    this.connection = options.connection;
    this.peerId = options.peerId;
    this.connectionId = options.connectionId;
    this.peerConnection = options.peerConnection;
    this.iceServers = options.iceServers || [];
    this.debugStatsId = uuid();
  }

  /**
   * Start collecting and sending debug stats
   */
  public startStats(): void {
    if (this.debugReportStarted) {
      log.debug('[WebRTCReporter] Stats already started');
      return;
    }

    log.debug('[WebRTCReporter] Starting debug stats collection');
    this.debugReportStarted = true;

    // Send debug report start message
    const startMessage = createDebugReportStartMessage(this.debugStatsId);
    this.connection.send(startMessage);

    // Send add connection message
    this.sendAddConnectionMessage();

    // Start periodic stats collection
    this.startStatsTimer();
  }

  /**
   * Stop collecting and sending debug stats
   */
  public stopStats(): void {
    if (!this.debugReportStarted) {
      log.debug('[WebRTCReporter] Stats not started');
      return;
    }

    log.debug('[WebRTCReporter] Stopping debug stats collection');

    // Stop the stats timer
    if (this.statsIntervalId) {
      clearInterval(this.statsIntervalId);
      this.statsIntervalId = null;
    }

    // Send debug report stop message
    const stopMessage = createDebugReportStopMessage(this.debugStatsId);
    this.connection.send(stopMessage);

    this.debugReportStarted = false;
  }

  /**
   * Handle signaling state change event
   */
  public onSignalingStateChange(signalingState: string): void {
    if (!this.debugReportStarted) return;

    log.debug('[WebRTCReporter] Signaling state change:', signalingState);

    const localDescription = this.peerConnection.localDescription;
    const remoteDescription = this.peerConnection.remoteDescription;

    const data = {
      localDescription: localDescription
        ? {
            sdp: localDescription.sdp,
            type: localDescription.type,
          }
        : null,
      remoteDescription: remoteDescription
        ? {
            sdp: remoteDescription.sdp,
            type: remoteDescription.type,
          }
        : null,
      signalingState,
    };

    const statsEvent = createStatsEvent({
      event: WebRTCStatsEvent.SIGNALING_CHANGE,
      tag: WebRTCStatsTag.CONNECTION,
      peerId: this.peerId,
      connectionId: this.connectionId,
      data,
    });

    this.sendStatsEvent(statsEvent);
  }

  /**
   * Handle ICE gathering state change event
   */
  public onIceGatheringStateChange(iceGatheringState: string): void {
    if (!this.debugReportStarted) return;

    log.debug('[WebRTCReporter] ICE gathering state change:', iceGatheringState);

    const statsEvent = createStatsEvent({
      event: WebRTCStatsEvent.ICE_GATHER_CHANGE,
      tag: WebRTCStatsTag.CONNECTION,
      peerId: this.peerId,
      connectionId: this.connectionId,
      data: iceGatheringState.toLowerCase(),
    });

    this.sendStatsEvent(statsEvent);
  }

  /**
   * Handle ICE candidate event
   */
  public onIceCandidate(candidate: RTCIceCandidate | null): void {
    if (!this.debugReportStarted || !candidate) return;

    log.debug('[WebRTCReporter] ICE candidate:', candidate);

    // Extract ufrag from candidate SDP
    let ufrag = '';
    const candidateSdp = candidate.candidate || '';
    const ufragIndex = candidateSdp.indexOf(UFRAG_LABEL);
    if (ufragIndex > 0) {
      ufrag = candidateSdp.substring(
        ufragIndex + UFRAG_LABEL.length + 1,
        ufragIndex + 2 * UFRAG_LABEL.length
      );
    }

    const data = {
      candidate: candidateSdp,
      sdpMLineIndex: candidate.sdpMLineIndex,
      sdpMid: candidate.sdpMid,
      usernameFragment: ufrag,
    };

    const statsEvent = createStatsEvent({
      event: WebRTCStatsEvent.ON_ICE_CANDIDATE,
      tag: WebRTCStatsTag.CONNECTION,
      peerId: this.peerId,
      connectionId: this.connectionId,
      data,
    });

    this.sendStatsEvent(statsEvent);
  }

  /**
   * Handle ICE connection state change event
   */
  public onIceConnectionStateChange(iceConnectionState: string): void {
    if (!this.debugReportStarted) return;

    log.debug('[WebRTCReporter] ICE connection state change:', iceConnectionState);

    const statsEvent = createStatsEvent({
      event: WebRTCStatsEvent.ON_ICE_CONNECTION_STATE_CHANGE,
      tag: WebRTCStatsTag.CONNECTION,
      peerId: this.peerId,
      connectionId: this.connectionId,
      data: iceConnectionState.toLowerCase(),
    });

    this.sendStatsEvent(statsEvent);
  }

  /**
   * Handle renegotiation needed event
   */
  public onRenegotiationNeeded(): void {
    if (!this.debugReportStarted) return;

    log.debug('[WebRTCReporter] Renegotiation needed');

    const statsEvent = createStatsEvent({
      event: WebRTCStatsEvent.ON_RENEGOTIATION_NEEDED,
      tag: WebRTCStatsTag.CONNECTION,
      peerId: this.peerId,
      connectionId: this.connectionId,
      data: '',
    });

    this.sendStatsEvent(statsEvent);
  }

  /**
   * Handle track event
   */
  public onTrack(track: MediaStreamTrack): void {
    if (!this.debugReportStarted) return;

    log.debug('[WebRTCReporter] Track added:', track);

    const statsEvent = createStatsEvent({
      event: WebRTCStatsEvent.ON_ADD_TRACK,
      tag: WebRTCStatsTag.TRACK,
      peerId: this.peerId,
      connectionId: this.connectionId,
      data: {
        kind: track.kind,
        id: track.id,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
      },
    });

    this.sendStatsEvent(statsEvent);
  }

  /**
   * Send the add connection message with peer configuration
   */
  private sendAddConnectionMessage(): void {
    const options = {
      peerId: this.peerId,
    };

    const iceServersConfig = this.iceServers.map((server) => ({
      urls: server.urls,
      username: server.username || '',
    }));

    const peerConfiguration = {
      bundlePolicy: 'max-compat',
      iceCandidatePoolSize: '0',
      iceServers: iceServersConfig,
      iceTransportPolicy: 'all',
      rtcpMuxPolicy: 'require',
    };

    const data = {
      options,
      peerConfiguration,
    };

    log.debug('[WebRTCReporter] Sending add connection message:', data);

    const statsEvent = createStatsEvent({
      event: WebRTCStatsEvent.ADD_CONNECTION,
      tag: WebRTCStatsTag.PEER,
      peerId: this.peerId,
      connectionId: this.connectionId,
      data,
    });

    this.sendStatsEvent(statsEvent);
  }

  /**
   * Start the periodic stats collection timer
   */
  private startStatsTimer(): void {
    this.statsIntervalId = setInterval(() => {
      this.collectAndSendStats();
    }, STATS_INTERVAL_MS);
  }

  /**
   * Collect and send WebRTC stats
   */
  private async collectAndSendStats(): Promise<void> {
    if (!this.debugReportStarted || !this.peerConnection) {
      return;
    }

    try {
      const stats = await this.peerConnection.getStats();
      const statsData: Record<string, unknown> = {};
      const audio: Record<string, unknown> = {};
      const connectionCandidates: Map<string, Record<string, unknown>> = new Map();
      const inBoundStats: unknown[] = [];
      const outBoundStats: unknown[] = [];
      const outBoundsArray: Record<string, unknown>[] = [];

      stats.forEach((report: RTCStatsReport) => {
        const reportData: Record<string, unknown> = {
          id: report.id,
          timestamp: report.timestamp / ONE_SEC,
          type: report.type,
        };

        // Copy all report members
        Object.keys(report).forEach((key) => {
          if (key !== 'id' && key !== 'timestamp' && key !== 'type') {
            reportData[key] = (report as any)[key];
          }
        });

        switch (report.type) {
          case 'inbound-rtp':
            if ((report as any).kind === 'audio') {
              statsData[report.id] = reportData;
              inBoundStats.push(reportData);
            }
            break;
          case 'outbound-rtp':
            if ((report as any).kind === 'audio') {
              statsData[report.id] = reportData;
              outBoundsArray.push(reportData);
            }
            break;
          case 'candidate-pair':
            statsData[report.id] = reportData;
            connectionCandidates.set(report.id, reportData);
            break;
          default:
            statsData[report.id] = reportData;
            break;
        }
      });

      // Process outbound stats with track info
      outBoundsArray.forEach((outBoundItem) => {
        const mediaSourceId = outBoundItem.mediaSourceId as string;
        if (mediaSourceId && statsData[mediaSourceId]) {
          const mediaSource = statsData[mediaSourceId] as Record<string, unknown>;
          outBoundItem.track = { ...mediaSource, id: mediaSourceId };
        }
        outBoundStats.push(outBoundItem);
      });

      // Find proper connection object
      const transportId = 'T01';
      const transport = statsData[transportId] as Record<string, unknown> | undefined;
      const selectedCandidatePairId = transport?.selectedCandidatePairId as string;

      let connectionData: Record<string, unknown> | undefined;
      if (selectedCandidatePairId) {
        const candidatePair = connectionCandidates.get(selectedCandidatePairId);
        if (candidatePair) {
          connectionData = { ...candidatePair };
          const localCandidateId = candidatePair.localCandidateId as string;
          const remoteCandidateId = candidatePair.remoteCandidateId as string;

          if (localCandidateId && statsData[localCandidateId]) {
            connectionData.local = { ...(statsData[localCandidateId] as object), id: localCandidateId };
          }
          if (remoteCandidateId && statsData[remoteCandidateId]) {
            connectionData.remote = { ...(statsData[remoteCandidateId] as object), id: remoteCandidateId };
          }
        }
      }

      // Build final data structure
      audio.inbound = inBoundStats;
      audio.outbound = outBoundStats;

      const data: Record<string, unknown> = {
        audio,
      };

      if (connectionData) {
        data.connection = connectionData;
      }

      const statsEvent = createStatsEvent({
        event: WebRTCStatsEvent.STATS,
        tag: WebRTCStatsTag.STATS,
        peerId: this.peerId,
        connectionId: this.connectionId,
        data,
        statsObject: statsData,
      });

      this.sendStatsEvent(statsEvent);
    } catch (error) {
      log.error('[WebRTCReporter] Error collecting stats:', error);
    }
  }

  /**
   * Send a stats event to the debug service
   */
  private sendStatsEvent(statsEvent: StatsEvent): void {
    const message = createDebugReportDataMessage(this.debugStatsId, statsEvent);
    this.connection.send(message);
  }

  /**
   * Get the debug stats ID
   */
  public getDebugStatsId(): string {
    return this.debugStatsId;
  }

  /**
   * Check if stats collection is active
   */
  public isActive(): boolean {
    return this.debugReportStarted;
  }
}
