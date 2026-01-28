import log from 'loglevel';
import {
  mediaDevices,
  RTCPeerConnection,
  RTCSessionDescription,
  MediaStream,
} from 'react-native-webrtc';
import type { MediaTrackConstraints } from 'react-native-webrtc/lib/typescript/Constraints';
import type RTCIceCandidateEvent from 'react-native-webrtc/lib/typescript/RTCIceCandidateEvent';
import type { RTCSessionDescriptionInit } from 'react-native-webrtc/lib/typescript/RTCSessionDescription';
import type RTCTrackEvent from 'react-native-webrtc/lib/typescript/RTCTrackEvent';
import type { CallOptions } from './call-options';
import type { DeferredPromise } from './promise';
import { createDeferredPromise } from './promise';
import type { WebRTCReporter } from './webrtc-reporter';

type MediaConstraints = {
  audio?: boolean | MediaTrackConstraints;
  video?: boolean | MediaTrackConstraints;
};

export class Peer {
  public static createOffer = async (callOptions: CallOptions) => {
    const peer = await new Peer(callOptions)
      .createPeerConnection()
      .attachLocalStream({ audio: true, video: false })
      .then((peer) => peer.createOffer())
      .then((peer) => peer.waitForIceGatheringComplete());

    return peer;
  };

  public mediaConstraints: MediaConstraints;
  private instance: RTCPeerConnection | null;
  private options: CallOptions;
  private iceGatheringComplete: DeferredPromise<boolean> | null;
  private reporter: WebRTCReporter | null = null;

  constructor(options: CallOptions) {
    this.instance = null;
    this.iceGatheringComplete = null;
    this.mediaConstraints = { audio: true, video: false };
    this.options = options;
  }

  /**
   * Set the WebRTC reporter for debug stats collection
   */
  public setReporter(reporter: WebRTCReporter | null): void {
    this.reporter = reporter;
  }

  /**
   * Get the underlying RTCPeerConnection instance
   */
  public getPeerConnection(): RTCPeerConnection | null {
    return this.instance;
  }

  /**
   * Get the ICE servers configuration
   */
  public getIceServers(): RTCIceServer[] {
    return this.getIceServersInternal();
  }

  public close = () => {
    log.debug('[Peer] Closing peer connection');
    if (this.instance) {
      this.instance.close();
      this.instance = null;
    }
    this.iceGatheringComplete?.reject(new Error('Peer connection closed'));
    this.iceGatheringComplete = null;
    this.options.localStream?.getTracks().forEach((track) => {
      track.stop();
    });
    this.options.localStream = undefined;
    this.options.remoteStream?.getTracks().forEach((track) => {
      track.stop();
    });
    this.options.remoteStream = undefined;
    return this;
  };

  public setRemoteDescription = async (session: RTCSessionDescriptionInit) => {
    if (!this.instance) {
      throw new Error('[Peer] Peer connection not created');
    }
    log.debug('[Peer] Setting remote description', session);
    await this.instance.setRemoteDescription(new RTCSessionDescription(session)).catch((error) => {
      log.error('[Peer] Error setting remote description', error);
    });
    return this;
  };
  public get remoteDescription() {
    if (!this.instance) {
      throw new Error('[Peer] Peer connection not created');
    }
    return this.instance.remoteDescription;
  }

  public get localDescription() {
    if (!this.instance) {
      throw new Error('[Peer] Peer connection not created');
    }
    return this.instance.localDescription;
  }

  public createPeerConnection = () => {
    log.debug('[Peer] Creating peer connection');

    this.iceGatheringComplete = createDeferredPromise(1000);
    const instance = new RTCPeerConnection({
      bundlePolicy: this.options.peerConnectionOptions?.bundlePolicy || 'max-compat',
      iceServers: this.getIceServers(),
      iceTransportPolicy: this.options.peerConnectionOptions?.iceTransportPolicy || 'all',
      rtcpMuxPolicy: this.options.peerConnectionOptions?.rtcpMuxPolicy || 'require',
      iceCandidatePoolSize: this.options.peerConnectionOptions?.prefetchIceCandidates ? 10 : 0,
    });

    this.instance = instance;
    this.instance.addEventListener('icecandidate', this.onIceCandidate);
    this.instance.addEventListener('icecandidateerror', this.onIceCandidateError);
    this.instance.addEventListener('icegatheringstatechange', this.onIceGatheringStateChange);

    this.instance.addEventListener('connectionstatechange', this.onConnectionStateChange);
    this.instance.addEventListener('iceconnectionstatechange', this.onIceConnectionStateChange);
    this.instance.addEventListener('signalingstatechange', this.onSignalingStateChange);
    this.instance.addEventListener('track', this.onTrackEvent);

    return this;
  };

  public createAnswer = async () => {
    if (!this.instance) {
      throw new Error('[Peer] Cannot create answer before peer connection');
    }
    const answer = await this.instance.createAnswer();
    await this.instance.setLocalDescription(answer).catch((error) => {
      log.error('[Peer] Error setting local description', error);
    });

    return this;
  };
  public createOffer = async () => {
    if (!this.instance) {
      throw new Error('[Peer] Cannot create offer before peer connection');
    }
    const offer = await this.instance.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });

    await this.instance.setLocalDescription(offer).catch((error) => {
      log.error('[Peer] Error setting local description', error);
    });

    return this;
  };

  public attachLocalStream = async (constraints: MediaConstraints) => {
    log.debug('[Peer] Attaching local stream', constraints);
    if (!this.instance) {
      throw new Error('[Peer] Peer connection not created');
    }
    this.mediaConstraints = constraints;

    if (this.options.localStream == null) {
      this.options.localStream = await mediaDevices.getUserMedia(constraints);
    }

    this.options.localStream.getTracks().forEach((track) => {
      log.debug('[Peer] Adding track', track);
      this.instance?.addTrack(track, this.options.localStream!);
    });

    return this;
  };

  public waitForIceGatheringComplete = async () => {
    if (!this.iceGatheringComplete) {
      throw new Error('Ice gathering not started');
    }
    await this.iceGatheringComplete.promise;
    log.debug('[Peer] ICE gathering complete');
    return this;
  };

  public setMediaStreamState = (stream: MediaStream, enabled: boolean) => {
    log.debug('[Peer] Setting media stream state', { enabled, stream });
    if (!stream) {
      throw new Error('[Peer] No media stream to set state');
    }
    stream.getTracks().forEach((track) => {
      log.debug('[Peer] Track state set', { track, enabled });
      track.enabled = enabled;
    });
    return this;
  };

  private onIceGatheringStateChange = () => {
    const iceGatheringState = this.instance?.iceGatheringState;
    log.debug('[Peer] ICE gathering state change', iceGatheringState);

    // Report to WebRTCReporter if available
    if (this.reporter && iceGatheringState) {
      this.reporter.onIceGatheringStateChange(iceGatheringState);
    }

    if (iceGatheringState === 'complete') {
      log.debug('[Peer] ICE gathering complete');
      this.iceGatheringComplete?.resolve(true);
      this.iceGatheringComplete = null;
    }
  };

  private onIceCandidate = (ev: RTCIceCandidateEvent<'icecandidate'>) => {
    log.debug('[Peer] ICE candidate', ev);

    // Report to WebRTCReporter if available
    if (this.reporter && ev.candidate) {
      this.reporter.onIceCandidate(ev.candidate as unknown as RTCIceCandidate);
    }

    this.iceGatheringComplete?.resolve(true);
    return;
  };

  private onIceCandidateError = (event: RTCIceCandidateEvent<'icecandidateerror'>) => {
    log.error('[Peer] ICE candidate error', event);
  };

  private getIceServersInternal() {
    if (
      this.options.peerConnectionOptions?.iceServers &&
      this.options.peerConnectionOptions?.iceServers.length > 0
    ) {
      return this.options.peerConnectionOptions.iceServers;
    }
    return [
      {
        urls: 'stun:stun.l.google.com:19302',
      },
    ];
  }

  private onTrackEvent = (event: RTCTrackEvent<'track'>) => {
    log.debug('[Peer] Remote track event', event);
    if (event.streams && event.streams.length > 0) {
      this.options.remoteStream = event.streams[0];
    }

    // Report to WebRTCReporter if available
    if (this.reporter && event.track) {
      this.reporter.onTrack(event.track as unknown as MediaStreamTrack);
    }
  };

  private onSignalingStateChange = () => {
    const signalingState = this.instance?.signalingState;
    log.debug('[Peer] Signaling state change', signalingState);

    // Report to WebRTCReporter if available
    if (this.reporter && signalingState) {
      this.reporter.onSignalingStateChange(signalingState);
    }
  };

  private onIceConnectionStateChange = () => {
    const iceConnectionState = this.instance?.iceConnectionState;
    log.debug('[Peer] ICE connection state change', iceConnectionState);

    // Report to WebRTCReporter if available
    if (this.reporter && iceConnectionState) {
      this.reporter.onIceConnectionStateChange(iceConnectionState);
    }
  };

  private onConnectionStateChange = () => {
    log.debug('[Peer] Connection state change', this.instance?.connectionState);
  };
}
