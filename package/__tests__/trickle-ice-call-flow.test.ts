import { Call } from '../lib/call';
import { TelnyxRTC } from '../lib/client';
import { TelnyxRTCMethod } from '../lib/messages/methods';

jest.mock('../lib/connection');
jest.mock('../lib/peer');

const trickleSdp = [
  'v=0',
  'o=- 46117317 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'm=audio 9 UDP/TLS/RTP/SAVPF 111',
  'a=mid:0',
  'a=candidate:1 1 UDP 2122252543 192.0.2.1 54400 typ host',
  'a=end-of-candidates',
  '',
].join('\r\n');

describe('Trickle ICE call lifecycle', () => {
  it('answers immediately without waiting for ICE gathering and strips SDP candidate lines', async () => {
    const sendAndWait = jest.fn().mockResolvedValue({});
    const connection = {
      sendAndWait,
      send: jest.fn(),
      addListener: jest.fn(),
    } as any;
    const peer = {
      attachLocalStream: jest.fn().mockResolvedValue(undefined),
      createAnswer: jest.fn().mockResolvedValue(undefined),
      waitForIceGatheringComplete: jest.fn().mockResolvedValue(undefined),
      localDescription: { sdp: trickleSdp },
      flushPendingLocalCandidates: jest.fn(),
      close: jest.fn(),
    } as any;
    peer.attachLocalStream.mockResolvedValue(peer);
    peer.createAnswer.mockResolvedValue(peer);

    const call = new Call({
      connection,
      options: {
        destinationNumber: '+15551234567',
        peerConnectionOptions: { useTrickleIce: true },
      },
      sessionId: 'session-123',
      direction: 'inbound',
      telnyxSessionId: 'telnyx-session-123',
      telnyxLegId: 'telnyx-leg-123',
      callId: 'call-123',
    });
    (call as any).peer = peer;

    await call.answer();

    expect(peer.waitForIceGatheringComplete).not.toHaveBeenCalled();
    const answerMessage = sendAndWait.mock.calls[0][0];
    expect(answerMessage.params.sdp).toContain('a=ice-options:trickle');
    expect(answerMessage.params.sdp).not.toContain('a=candidate:');
    expect(answerMessage.params.sdp).not.toContain('a=end-of-candidates');
    expect(peer.flushPendingLocalCandidates).toHaveBeenCalled();
  });

  it('routes incoming candidate and end-of-candidates messages to the matching call', () => {
    const client = new TelnyxRTC({ logLevel: 'error' });
    const call = {
      callId: 'call-123',
      state: 'active',
      on: jest.fn(),
      off: jest.fn(),
      handleRemoteCandidate: jest.fn(),
      handleRemoteEndOfCandidates: jest.fn(),
    } as any;

    (client as any).addCall(call);

    (client as any).onSocketMessage({
      method: TelnyxRTCMethod.CANDIDATE,
      params: {
        candidate: 'candidate:1 1 UDP 2122252543 192.0.2.1 54400 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0,
        dialogParams: { callID: 'call-123' },
      },
    });

    (client as any).onSocketMessage({
      method: TelnyxRTCMethod.END_OF_CANDIDATES,
      params: {
        dialogParams: { callID: 'call-123' },
      },
    });

    expect(call.handleRemoteCandidate).toHaveBeenCalledWith({
      candidate: 'candidate:1 1 UDP 2122252543 192.0.2.1 54400 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
    });
    expect(call.handleRemoteEndOfCandidates).toHaveBeenCalledTimes(1);
  });

  it('queues remote trickle events until the matching call is tracked', () => {
    const client = new TelnyxRTC({ logLevel: 'error' });
    const call = {
      callId: 'call-123',
      state: 'active',
      on: jest.fn(),
      off: jest.fn(),
      handleRemoteCandidate: jest.fn(),
      handleRemoteEndOfCandidates: jest.fn(),
    } as any;

    (client as any).onSocketMessage({
      method: TelnyxRTCMethod.CANDIDATE,
      params: {
        candidate: 'candidate:1 1 UDP 2122252543 192.0.2.1 54400 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0,
        dialogParams: { callID: 'call-123' },
      },
    });

    (client as any).onSocketMessage({
      method: TelnyxRTCMethod.END_OF_CANDIDATES,
      params: {
        dialogParams: { callID: 'call-123' },
      },
    });

    expect(call.handleRemoteCandidate).not.toHaveBeenCalled();
    expect(call.handleRemoteEndOfCandidates).not.toHaveBeenCalled();

    (client as any).addCall(call);

    expect(call.handleRemoteCandidate).toHaveBeenCalledWith({
      candidate: 'candidate:1 1 UDP 2122252543 192.0.2.1 54400 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
    });
    expect(call.handleRemoteEndOfCandidates).toHaveBeenCalledTimes(1);
  });
});
