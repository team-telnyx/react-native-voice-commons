import { EventEmitter } from 'eventemitter3';
import log from 'loglevel';
import uuid from 'uuid-random';
import type { CallOptions } from './call-options';
import { Connection } from './connection';
import type { AnswerEvent, ByeEvent, RingingEvent } from './messages/call';
import {
  createAnswerAck,
  createAnswerMessage,
  createDTMFRequest,
  createHangupRequest,
  createInviteMessage,
  createModifyCallRequest,
  createRingingAckMessage,
  isAnswerEvent,
  isByeEvent,
  isDTMFResponse,
  isInviteACKMessage,
  isModifyCallAnswer,
  isRingingEvent,
} from './messages/call';
import { createAttachMessage } from './messages/attach';
import { Peer } from './peer';
import { WebRTCReporter } from './webrtc-reporter';

type CallEvents = {
  'telnyx.call.state': (call: Call, state: CallState) => void;
};

export type CallState = 'new' | 'ringing' | 'connecting' | 'active' | 'ended' | 'held' | 'dropped';

type CallConstructorParams = {
  connection: Connection;
  options: CallOptions;
  sessionId: string;
  direction: CallDirection;
  telnyxSessionId: string | null;
  telnyxLegId: string | null;
  telnyxCallControlId?: string | null;
  callId: string | null;
  callState?: CallState;
  debug?: boolean;
};

export type CallDirection = 'inbound' | 'outbound';

export type CreateInboundCall = {
  connection: Connection;
  options: CallOptions;
  sessionId: string;
  telnyxSessionId: string;
  telnyxLegId: string;
  telnyxCallControlId?: string | null;
  remoteSDP: string;
  callId: string;
  inviteCustomHeaders?: { name: string; value: string }[] | null;
  initialState?: CallState;
  debug?: boolean;
};

// TODO persist customHeaders and clientState
export class Call extends EventEmitter<CallEvents> {
  public direction: CallDirection;
  public callId: string;
  public telnyxSessionId: string | null;
  public telnyxCallControlId: string | null;
  public telnyxLegId: string | null;
  public state: CallState;

  /**
   * Custom headers received from the WebRTC INVITE message.
   * These headers are passed during call initiation and can contain application-specific information.
   * Format should be [{"name": "X-Header-Name", "value": "Value"}] where header names must start with "X-".
   */
  public inviteCustomHeaders: { name: string; value: string }[] | null = null;

  /**
   * Custom headers received from the WebRTC ANSWER message.
   * These headers are passed during call acceptance and can contain application-specific information.
   * Format should be [{"name": "X-Header-Name", "value": "Value"}] where header names must start with "X-".
   */
  public answerCustomHeaders: { name: string; value: string }[] | null = null;

  static async createInboundCall({
    connection,
    options,
    remoteSDP,
    sessionId,
    telnyxLegId,
    telnyxSessionId,
    callId,
    inviteCustomHeaders = null,
    initialState = 'ringing',
    debug = false,
  }: CreateInboundCall) {
    const call = new Call({
      connection,
      options,
      sessionId,
      direction: 'inbound',
      telnyxLegId,
      telnyxSessionId,
      callId,
      callState: initialState,
      debug,
    });

    // Store the custom headers from the INVITE message
    call.inviteCustomHeaders = inviteCustomHeaders;

    // Check if the connection has a reference to the client with stored push notification CallKit UUID
    // The client should store the UUID when CallKitHandler processes the push notification
    const connectionClient = (connection as any)._client;
    if (connectionClient && typeof connectionClient.getPushNotificationCallKitUUID === 'function') {
      const storedCallKitUUID = connectionClient.getPushNotificationCallKitUUID();
      if (storedCallKitUUID) {
        log.debug('[Call] Automatically assigning stored CallKit UUID to new inbound call:', {
          callId,
          storedCallKitUUID,
        });

        // Set multiple CallKit UUID properties on the call object during creation
        (call as any)._callKitUUID = storedCallKitUUID;
        (call as any)._isPushNotificationCall = true;
        (call as any)._pushCallKitUUID = storedCallKitUUID;
        (call as any)._originalCallKitUUID = storedCallKitUUID;

        // Make these properties non-configurable to prevent accidental deletion
        try {
          Object.defineProperty(call, '_callKitUUID', {
            value: storedCallKitUUID,
            writable: false,
            enumerable: false,
            configurable: false,
          });
          Object.defineProperty(call, '_isPushNotificationCall', {
            value: true,
            writable: false,
            enumerable: false,
            configurable: false,
          });
        } catch (error) {
          log.warn('[Call] Could not make UUID properties non-configurable:', error);
        }

        // Clear the stored UUID since we've used it
        connectionClient.setPushNotificationCallKitUUID(null);

        log.debug('[Call] CallKit UUID properties set during call creation:', {
          _callKitUUID: (call as any)._callKitUUID,
          _isPushNotificationCall: (call as any)._isPushNotificationCall,
          _pushCallKitUUID: (call as any)._pushCallKitUUID,
          _originalCallKitUUID: (call as any)._originalCallKitUUID,
        });
      }
    }

    call.peer = new Peer(options);
    call.peer.createPeerConnection();
    call.peer.setRemoteDescription({ type: 'offer', sdp: remoteSDP });

    // Initialize WebRTC reporter if debug mode is enabled
    if (debug) {
      call.initializeReporter();
    }

    call.setState(initialState);

    return call;
  }

  private connection: Connection;
  private options: CallOptions;
  private peer: Peer | null;
  private sessionId: string;
  private reporter: WebRTCReporter | null = null;
  private debugEnabled: boolean = false;

  constructor({
    connection,
    options,
    sessionId,
    direction,
    callId,
    telnyxLegId,
    telnyxSessionId,
    telnyxCallControlId = null,
    callState = 'new',
    debug = false,
  }: CallConstructorParams) {
    super();

    this.connection = connection;
    this.options = options;
    this.sessionId = sessionId;
    this.callId = callId ?? uuid();
    this.direction = direction;
    this.state = callState;
    this.telnyxLegId = telnyxLegId;
    this.telnyxSessionId = telnyxSessionId;
    this.telnyxCallControlId = telnyxCallControlId;
    this.peer = null;
    this.debugEnabled = debug;

    this.connection.addListener('telnyx.socket.message', this.onSocketMessage);
  }

  /**
   * Initialize the WebRTC reporter for debug stats collection
   */
  private initializeReporter(): void {
    if (!this.peer || !this.debugEnabled) {
      return;
    }

    const peerConnection = this.peer.getPeerConnection();
    if (!peerConnection) {
      log.warn('[Call] Cannot initialize reporter: no peer connection');
      return;
    }

    log.debug('[Call] Initializing WebRTC reporter for debug stats');

    this.reporter = new WebRTCReporter({
      connection: this.connection,
      peerId: this.callId,
      connectionId: this.telnyxLegId || this.callId,
      peerConnection: peerConnection as any,
      iceServers: this.peer.getIceServers() as any,
    });

    // Set the reporter on the peer for event forwarding
    this.peer.setReporter(this.reporter);

    // Start stats collection
    this.reporter.startStats();
  }

  /**
   * Start debug stats collection manually
   * This can be called after the call is established if debug mode was not enabled initially
   */
  public startDebugStats(): void {
    if (this.reporter) {
      log.debug('[Call] Debug stats already started');
      return;
    }

    if (!this.peer) {
      log.warn('[Call] Cannot start debug stats: no peer connection');
      return;
    }

    this.debugEnabled = true;
    this.initializeReporter();
  }

  /**
   * Stop debug stats collection
   */
  public stopDebugStats(): void {
    if (this.reporter) {
      log.debug('[Call] Stopping debug stats collection');
      this.reporter.stopStats();
      this.reporter = null;
    }

    if (this.peer && typeof this.peer.setReporter === 'function') {
      this.peer.setReporter(null);
    }
  }

  /**
   * Check if debug stats collection is active
   */
  public isDebugStatsActive(): boolean {
    return this.reporter?.isActive() ?? false;
  }

  /**
   * Get the debug stats ID
   */
  public getDebugStatsId(): string | null {
    return this.reporter?.getDebugStatsId() ?? null;
  }

  public get remoteStream() {
    return this.options.remoteStream;
  }

  public get localStream() {
    return this.options.localStream;
  }

  /**
   * Accept an incoming call
   * This method will attach the local audio stream, create an answer,
   * and send the answer message to the Telnyx platform.
   * It will also set the call state to 'active'.
   * @param customHeaders Optional custom headers to include with the answer
   * @throws {Error} If the peer connection is not created
   * @returns {Promise<void>} A promise that resolves when the call is accepted
   */
  public answer = async (customHeaders?: { name: string; value: string }[]) => {
    if (!this.peer) {
      throw new Error('[Call] Peer is not created');
    }

    // Set state to connecting when starting the answer process
    log.debug('[Call] Setting state to connecting before answering');
    this.setState('connecting');

    await this.peer
      .attachLocalStream({ audio: true, video: false })
      .then((peer) => peer.createAnswer())
      .then((peer) => peer.waitForIceGatheringComplete());

    await this.connection.sendAndWait(
      createAnswerMessage({
        callId: this.callId,
        dialogParams: {},
        sdp: this.peer.localDescription!.sdp,
        telnyxLegId: this.telnyxLegId!,
        telnyxSessionId: this.telnyxSessionId!,
        sessionId: this.sessionId,
        customHeaders,
      })
    );

    this.setState('active');
  };

  /**
   * Accept an incoming call for attachment
   * This method will attach the local audio stream, create an answer,
   * and send the answer message to the Telnyx platform for call reattachment.
   * It will also set the call state to 'active'.
   * @throws {Error} If the peer connection is not created
   * @returns {Promise<void>} A promise that resolves when the call is attached
   */
  public answerAttach = async () => {
    log.debug('[Call] Starting answerAttach process');

    if (!this.peer) {
      log.error('[Call] No peer connection available for answerAttach');
      throw new Error('[Call] Peer is not created');
    }

    try {
      log.debug('[Call] Attaching local stream and creating answer for reattachment');
      await this.peer
        .attachLocalStream({ audio: true, video: false })
        .then((peer) => {
          log.debug('[Call] Local stream attached, creating answer');
          return peer.createAnswer();
        })
        .then((peer) => {
          log.debug('[Call] Answer created, waiting for ICE gathering');
          return peer.waitForIceGatheringComplete();
        });

      log.debug('[Call] ICE gathering complete, preparing answer message');

      if (!this.peer.localDescription?.sdp) {
        log.error('[Call] No local SDP available for answer message');
        throw new Error('[Call] Local SDP not available');
      }

      const attachMessage = createAttachMessage({
        callId: this.callId,
        sessionId: this.sessionId,
        sdp: this.peer.localDescription.sdp,
        customHeaders: this.inviteCustomHeaders || [],
        destinationNumber: this.options.destinationNumber || '',
        callerIdName: this.options.callerIdName || '',
        callerIdNumber: this.options.callerIdNumber || '',
        clientState: this.options.clientState || '',
        userVariables: [], // Not available in CallOptions, using empty array
      });

      log.debug('[Call] Sending attach message for reattachment:', {
        callId: this.callId,
        sessionId: this.sessionId,
        hasCustomHeaders: !!(this.inviteCustomHeaders && this.inviteCustomHeaders.length > 0),
      });

      // Send attach message for call reattachment (critical for WebRTC media flow)
      await this.connection.sendAndWait(attachMessage);

      log.debug('[Call] Attach message sent successfully, setting call to active');
      this.setState('active');
      log.debug('[Call] answerAttach completed successfully');
    } catch (error) {
      log.error('[Call] answerAttach failed:', error);
      throw error;
    }
  };

  /**
   * Hang up the call
   * This method will send a hangup request to the Telnyx platform,
   * close the peer connection, and set the call state to 'ended'.
   * @param customHeaders Optional custom headers to include with the hangup request
   */
  public hangup = (customHeaders?: { name: string; value: string }[]) => {
    // Stop debug stats collection before ending the call
    this.stopDebugStats();

    this.connection.send(
      createHangupRequest({
        callId: this.callId,
        telnyxLegId: this.telnyxLegId!,
        telnyxSessionId: this.telnyxSessionId!,
        cause: 'USER_BUSY',
        causeCode: 17,
        sessionId: this.sessionId,
        customHeaders,
      })
    );

    this.peer?.close();
    this.setState('ended');
  };

  /**
   * Hold the call
   * This method will send a hold request to the Telnyx platform,
   * and set the call state to 'held'.
   * @throws {Error} If the hold action fails or if the response is invalid
   * @return {Promise<void>} A promise that resolves when the call is held
   */

  public hold = async () => {
    const holdRequest = createModifyCallRequest({
      action: 'hold',
      callId: this.callId,
      sessionId: this.sessionId,
    });

    const result = await this.connection.sendAndWait(holdRequest);
    if (!isModifyCallAnswer(result)) {
      throw new Error(`[Call] Invalid hold response received: ${JSON.stringify(result)}`);
    }
    if (result.result.holdState !== 'held') {
      throw new Error(`[Call] Hold action failed: ${JSON.stringify(result)}`);
    }
    this.setState('held');
  };

  /**
   * Unhold the call
   * This method will send an unhold request to the Telnyx platform,
   * and set the call state to 'active'.
   * @throws {Error} If the unhold action fails or if the response is invalid
   * @return {Promise<void>} A promise that resolves when the call is unheld
   */
  public unhold = async () => {
    const unholdRequest = createModifyCallRequest({
      action: 'unhold',
      sessionId: this.sessionId,
      callId: this.callId,
    });
    const result = await this.connection.sendAndWait(unholdRequest);
    if (!isModifyCallAnswer(result)) {
      throw new Error(`[Call] Invalid hold response received: ${JSON.stringify(result)}`);
    }
    if (result.result.holdState !== 'held') {
      throw new Error(`[Call] Hold action failed: ${JSON.stringify(result)}`);
    }

    this.setState('active');
  };

  /**
   *
   * @param digits The DTMF digits to send
   * This method will send a DTMF request to the Telnyx platform,
   * and return the result of the DTMF action.
   * @throws {Error} If the DTMF response is invalid
   * @returns {Promise<string>} A promise that resolves with the DTMF result
   * @example
   * ```typescript
   * const result = await call.dtmf('1234');
   * console.log(result); // 'SENT' or other result based on the DTMF action
   * ```
   */
  public dtmf = async (digits: string) => {
    const DTMFRequest = createDTMFRequest({
      digits,
      sessionId: this.sessionId,
      callId: this.callId,
    });

    const response = await this.connection.sendAndWait(DTMFRequest);
    if (!isDTMFResponse(response)) {
      throw new Error(`[Call] Invalid DTMF response received: ${JSON.stringify(response)}`);
    }
    return response.result;
  };

  /**
   * Mute the local audio stream
   * This method will set the local audio stream state to false,
   * effectively muting the audio.
   * @throws {Error} If the peer connection or local stream is not set
   * @returns {void}
   * @example
   * ```typescript
   * call.mute();
   * console.log('Call muted');
   * ```
   * @see {@link Call.unmute} for unmuting the call.
   * @see {@link Call.deaf} for deafening the call.
   * @see {@link Call.undeaf} for undeafening the call.
   *
   */

  public mute = () => {
    if (!this.peer) {
      throw new Error('[Call] Peer not created');
    }
    if (!this.options.localStream) {
      throw new Error('[Call] Local stream not set');
    }
    this.peer.setMediaStreamState(this.options.localStream, false);
  };

  /**
   * Unmute the local audio stream
   * This method will set the local audio stream state to true,
   * effectively unmuting the audio.
   * @throws {Error} If the peer connection or local stream is not set
   * @returns {void}
   * @example
   * ```typescript
   * call.unmute();
   * console.log('Call unmuted');
   * ```
   * @see {@link Call.mute} for muting the call.
   * @see {@link Call.deaf} for deafening the call.
   * @see {@link Call.undeaf} for undeafening the call.
   */
  public unmute = () => {
    if (!this.peer) {
      throw new Error('[Call] Peer not created');
    }
    if (!this.options.localStream) {
      throw new Error('[Call] Local stream not set');
    }
    this.peer.setMediaStreamState(this.options.localStream, true);
  };

  /**
   * Deafen the remote audio stream
   * This method will set the remote audio stream state to false,
   * effectively deafening the audio.
   * @throws {Error} If the peer connection or remote stream is not set
   * @returns {void}
   * @example
   * ```typescript
   * call.deaf();
   * console.log('Call deafened');
   * ```
   * @see {@link Call.undeaf} for undeafening the call.
   * @see {@link Call.mute} for muting the call.
   * @see {@link Call.unmute} for unmuting the call.
   *
   */
  public deaf = () => {
    if (!this.peer) {
      throw new Error('[Call] Peer not created');
    }
    if (!this.options.remoteStream) {
      throw new Error('[Call] Remote stream not set');
    }
    this.peer.setMediaStreamState(this.options.remoteStream, false);
  };

  /**
   * Undeafen the remote audio stream
   * This method will set the remote audio stream state to true,
   * effectively undeafening the audio.
   * @throws {Error} If the peer connection or remote stream is not set
   * @returns {void}
   * @example
   * ```typescript
   * call.undeaf();
   * console.log('Call undeafened');
   * ```
   * @see {@link Call.deaf} for deafening the call.
   * @see {@link Call.mute} for muting the call.
   *  @see {@link Call.unmute} for unmuting the call.
   *
   */
  public undeaf = () => {
    if (!this.peer) {
      throw new Error('[Call] Peer not created');
    }
    if (!this.options.remoteStream) {
      throw new Error('[Call] Remote stream not set');
    }
    this.peer.setMediaStreamState(this.options.remoteStream, true);
  };

  /**
   * Handle early media/ringback from media events with SDP
   * This method sets up early media playback for ringback tones or announcements
   * received before the call is answered.
   * @param sdp - The SDP from the media event for early media setup
   */
  public handleEarlyMedia = (sdp: string) => {
    log.debug('[Call] Handling early media with SDP');

    if (!this.peer) {
      log.warn('[Call] No peer connection available for early media setup');
      return;
    }

    try {
      // For outbound calls, the media SDP is an answer to our local offer
      // For inbound calls, the media SDP would be an offer (but inbound calls typically get SDP in invite)
      const sdpType = this.direction === 'outbound' ? 'answer' : 'offer';

      log.debug(`[Call] Setting early media SDP as ${sdpType} for ${this.direction} call`);
      this.peer.setRemoteDescription({ type: sdpType, sdp });
      log.debug('[Call] Early media SDP set successfully');
    } catch (error) {
      log.error('[Call] Failed to set early media SDP:', error);
    }
  };

  /**
   * Handle media update events (audio/video enable/disable)
   * @param mediaUpdate - Object containing audio/video states and target
   */
  public handleMediaUpdate = (mediaUpdate: {
    audio?: boolean;
    video?: boolean;
    target?: 'local' | 'remote';
  }) => {
    log.debug('[Call] Handling media update:', mediaUpdate);

    const { audio, video, target = 'remote' } = mediaUpdate;

    // Handle audio changes
    if (audio !== undefined) {
      try {
        if (target === 'local' && this.options.localStream) {
          this.peer?.setMediaStreamState(this.options.localStream, audio);
          log.debug(`[Call] ${audio ? 'Enabled' : 'Disabled'} local audio`);
        } else if (target === 'remote' && this.options.remoteStream) {
          this.peer?.setMediaStreamState(this.options.remoteStream, audio);
          log.debug(`[Call] ${audio ? 'Enabled' : 'Disabled'} remote audio`);
        }
      } catch (error) {
        log.error('[Call] Error handling audio media update:', error);
      }
    }

    // Handle video changes (if supported in the future)
    if (video !== undefined) {
      log.debug(
        `[Call] Video media update received but not yet implemented: ${target} video ${video ? 'enabled' : 'disabled'}`
      );
      // TODO: Implement video handling when video calling is supported
    }
  };

  /**
   * Get the Telnyx IDs associated with the call
   * This method returns an object containing the Telnyx session ID, leg ID, and call control ID.
   * @returns {Object} An object containing the Telnyx IDs
   */
  public get telnyxIds() {
    return {
      telnyxSessionId: this.telnyxSessionId,
      telnyxLegId: this.telnyxLegId,
      telnyxCallControlId: this.telnyxCallControlId,
    };
  }
  public invite = async () => {
    this.peer = await Peer.createOffer(this.options);

    // Initialize WebRTC reporter if debug mode is enabled
    if (this.debugEnabled) {
      this.initializeReporter();
    }

    // Store the custom headers we're sending with the invite
    this.inviteCustomHeaders = this.options.customHeaders || null;

    const msg = await this.connection.sendAndWait(
      createInviteMessage({
        attach: false,
        callOptions: this.options,
        sessionId: this.sessionId,
        callId: this.callId,
        sdp: this.peer.localDescription!.sdp,
      })
    );

    if (!isInviteACKMessage(msg)) {
      throw new Error(`[Call] Invalid invite ACK message received: ${JSON.stringify(msg)}`);
    }
    this.callId = msg.result.callID;
  };

  private setState = (state: CallState) => {
    this.state = state;
    this.emit('telnyx.call.state', this, state);
  };

  /**
   * Set the call to connecting state (used for push notification calls when answered via CallKit)
   */
  public setConnecting = () => {
    log.debug('[Call] Setting state to connecting');
    this.setState('connecting');
  };

  /**
   * Set the call to dropped state (used when network connection is lost)
   */
  public setDropped = () => {
    log.debug('[Call] Setting state to dropped due to network loss');
    this.setState('dropped');
  };

  /**
   * Set the call to active state (used when answer event is received)
   */
  public setActive = () => {
    log.debug('[Call] Setting state to active');
    this.setState('active');
  };

  /**
   * Handle remote answer SDP from answer events
   * @param sdp - The SDP from the answer event
   */
  public handleRemoteAnswer = (sdp: string) => {
    log.debug('[Call] Handling remote answer SDP');

    if (!this.peer) {
      log.warn('[Call] No peer connection available for remote answer SDP');
      return;
    }

    try {
      this.peer.setRemoteDescription({ type: 'answer', sdp });
      log.debug('[Call] Remote answer SDP set successfully');
    } catch (error) {
      log.error('[Call] Failed to set remote answer SDP:', error);
    }
  };

  /**
   * Dispose of the peer connection and clean up resources
   * This should be called before creating a new peer for the same call
   */
  public disposePeer = () => {
    if (this.peer) {
      log.debug('[Call] Disposing of existing peer connection');
      this.peer.close();
      this.peer = null;
      log.debug('[Call] Peer connection disposed successfully');
    } else {
      log.debug('[Call] No peer connection to dispose');
    }
  };

  private onSocketMessage = (msg: unknown) => {
    if (isRingingEvent(msg) && msg.params.callID === this.callId) {
      return this.handleRingingEvent(msg);
    }

    // Answer events are now handled by the TelnyxRTC client to avoid duplication
    // The client will call handleRemoteAnswer() when needed

    if (isByeEvent(msg) && msg.params.callID === this.callId) {
      return this.handleHangupEvent(msg);
    }
  };

  private handleRingingEvent = (msg: RingingEvent) => {
    log.debug('[Call] Ringing event received', msg);
    this.setState('ringing');
    this.telnyxLegId = msg.params.telnyx_leg_id;
    this.telnyxSessionId = msg.params.telnyx_session_id;
    this.connection.send(createRingingAckMessage(msg.id));
  };


  private handleHangupEvent = (msg: ByeEvent) => {
    log.debug('[Call] Hangup event received', msg);

    // Stop debug stats collection before ending the call
    this.stopDebugStats();

    this.setState('ended');

    this.peer?.close();
  };
}
