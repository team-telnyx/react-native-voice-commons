import {
  createUpdateMediaRequest,
  isUpdateMediaAnswer,
  isJsonRpcErrorMessage,
} from '../lib/messages/call';

describe('updateMedia messages (ICE restart recovery)', () => {
  describe('createUpdateMediaRequest', () => {
    it('builds a telnyx_rtc.modify request with the updateMedia action', () => {
      const request = createUpdateMediaRequest({
        sessionId: 'session-id',
        callId: 'signaling-call-id',
        sdp: 'offer-sdp',
        trickleIce: true,
      });

      expect(request.jsonrpc).toBe('2.0');
      expect(typeof request.id).toBe('string');
      expect(request.method).toBe('telnyx_rtc.modify');
      expect(request.params).toEqual({
        sessid: 'session-id',
        action: 'updateMedia',
        sdp: 'offer-sdp',
        trickle: true,
        dialogParams: { callId: 'signaling-call-id' },
      });
    });

    it('does not mutate the hold/unhold request shape', () => {
      const request = createUpdateMediaRequest({
        sessionId: 'session-id',
        callId: 'signaling-call-id',
        sdp: 'offer-sdp',
        trickleIce: false,
      });
      expect(request.method).toBe('telnyx_rtc.modify');
      expect(request.params.action).toBe('updateMedia');
      expect(request.params.trickle).toBe(false);
    });
  });

  describe('isUpdateMediaAnswer', () => {
    it('accepts a well-formed updateMedia answer', () => {
      const answer = {
        id: 'id-1',
        jsonrpc: '2.0',
        result: {
          action: 'updateMedia',
          callID: 'signaling-call-id',
          sdp: 'answer-sdp',
          sessid: 'session-id',
        },
        voice_sdk_id: 'voice-sdk-id',
      };
      expect(isUpdateMediaAnswer(answer)).toBe(true);
    });

    it('rejects responses missing the answer SDP', () => {
      const answer = {
        id: 'id-1',
        jsonrpc: '2.0',
        result: {
          action: 'updateMedia',
          callID: 'signaling-call-id',
          sessid: 'session-id',
        },
        voice_sdk_id: 'voice-sdk-id',
      };
      expect(isUpdateMediaAnswer(answer)).toBe(false);
    });

    it('rejects other modify actions', () => {
      const answer = {
        id: 'id-1',
        jsonrpc: '2.0',
        result: {
          action: 'hold',
          callID: 'signaling-call-id',
          sdp: 'answer-sdp',
          sessid: 'session-id',
        },
        voice_sdk_id: 'voice-sdk-id',
      };
      expect(isUpdateMediaAnswer(answer)).toBe(false);
    });
  });

  describe('isJsonRpcErrorMessage', () => {
    it('identifies error responses', () => {
      expect(
        isJsonRpcErrorMessage({ id: '1', jsonrpc: '2.0', error: { code: 1, message: 'x' } })
      ).toBe(true);
    });

    it('does not flag result responses', () => {
      expect(isJsonRpcErrorMessage({ id: '1', jsonrpc: '2.0', result: {} })).toBe(false);
      expect(isJsonRpcErrorMessage(null)).toBe(false);
    });
  });
});
