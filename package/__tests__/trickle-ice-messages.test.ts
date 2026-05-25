import {
  createCandidateMessage,
  createEndOfCandidatesMessage,
  isCandidateEvent,
  isEndOfCandidatesEvent,
} from '../lib/messages/call';
import { TelnyxRTCMethod } from '../lib/messages/methods';
import {
  addTrickleIceCapability,
  cleanCandidateString,
  removeCandidateLines,
  normalizeRemoteCandidateString,
} from '../lib/sdp-utils';

describe('Trickle ICE signaling messages', () => {
  it('creates a telnyx_rtc.candidate message with call and ICE metadata', () => {
    const message = createCandidateMessage({
      sessionId: 'session-123',
      callId: 'call-123',
      candidate: 'candidate:1 1 UDP 2122252543 192.0.2.1 54400 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
    });

    expect(message).toEqual({
      id: expect.any(String),
      jsonrpc: '2.0',
      method: TelnyxRTCMethod.CANDIDATE,
      params: {
        sessid: 'session-123',
        candidate: 'candidate:1 1 UDP 2122252543 192.0.2.1 54400 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0,
        dialogParams: {
          callID: 'call-123',
        },
      },
    });
  });

  it('creates a telnyx_rtc.endOfCandidates message scoped to the call', () => {
    const message = createEndOfCandidatesMessage({ sessionId: 'session-123', callId: 'call-123' });

    expect(message).toEqual({
      id: expect.any(String),
      jsonrpc: '2.0',
      method: TelnyxRTCMethod.END_OF_CANDIDATES,
      params: {
        sessid: 'session-123',
        dialogParams: {
          callID: 'call-123',
        },
      },
    });
  });

  it('identifies incoming candidate and end-of-candidates events', () => {
    expect(
      isCandidateEvent({
        method: TelnyxRTCMethod.CANDIDATE,
        params: {
          candidate: 'candidate:1 1 UDP 2122252543 192.0.2.1 54400 typ host',
          sdpMid: '0',
          sdpMLineIndex: 0,
          dialogParams: { callID: 'call-123' },
        },
      })
    ).toBe(true);

    expect(
      isEndOfCandidatesEvent({
        method: TelnyxRTCMethod.END_OF_CANDIDATES,
        params: {
          dialogParams: { callID: 'call-123' },
        },
      })
    ).toBe(true);
  });
});

describe('Trickle ICE SDP utilities', () => {
  const sdp = [
    'v=0',
    'o=- 46117317 2 IN IP4 127.0.0.1',
    's=-',
    't=0 0',
    'a=group:BUNDLE 0',
    'm=audio 9 UDP/TLS/RTP/SAVPF 111',
    'a=mid:0',
    'a=rtcp-mux',
    'a=candidate:1 1 UDP 2122252543 192.0.2.1 54400 typ host',
    'a=end-of-candidates',
    '',
  ].join('\r\n');

  it('adds ice-options:trickle once', () => {
    const once = addTrickleIceCapability(sdp);
    const twice = addTrickleIceCapability(once);

    expect(once).toContain('a=ice-options:trickle');
    expect(twice.match(/a=ice-options:trickle/g)).toHaveLength(1);
  });

  it('inserts ice-options after origin and normalizes existing ICE options', () => {
    const withTrickle = addTrickleIceCapability(sdp);
    const lines = withTrickle.split(/\r\n|\n|\r/);
    const originIndex = lines.findIndex((line) => line.startsWith('o='));

    expect(lines[originIndex + 1]).toBe('a=ice-options:trickle');

    expect(
      addTrickleIceCapability(
        [
          'v=0',
          'o=- 46117317 2 IN IP4 127.0.0.1',
          'a=ice-options:trickle renomination',
          's=-',
        ].join('\r\n')
      )
    ).toContain('a=ice-options:trickle\r\ns=-');
  });

  it('removes candidate and end-of-candidates lines from initial SDP', () => {
    const stripped = removeCandidateLines(sdp);

    expect(stripped).not.toContain('a=candidate:');
    expect(stripped).not.toContain('a=end-of-candidates');
    expect(stripped).toContain('m=audio');
  });

  it('normalizes incoming candidate strings for RTCIceCandidate', () => {
    expect(
      normalizeRemoteCandidateString('a=candidate:1 1 UDP 2122252543 192.0.2.1 54400 typ host')
    ).toBe('candidate:1 1 UDP 2122252543 192.0.2.1 54400 typ host');
  });

  it('cleans local candidates before signaling to match Android', () => {
    expect(
      cleanCandidateString(
        'a=candidate:1 1 UDP 2122252543 192.0.2.1 54400 typ host generation 0 ufrag abc network-id 3 network-cost 10'
      )
    ).toBe('candidate:1 1 UDP 2122252543 192.0.2.1 54400 typ host');

    expect(
      cleanCandidateString(
        'candidate:2 1 UDP 1686052607 203.0.113.1 54000 typ srflx raddr 10.0.0.1 rport 54000 generation 0 ufrag xyz'
      )
    ).toBe('candidate:2 1 UDP 1686052607 203.0.113.1 54000 typ srflx raddr 10.0.0.1 rport 54000');
  });
});
