import { isAnswerEvent, type AnswerEvent } from '../lib/messages/call';

describe('AnswerEvent', () => {
  describe('isAnswerEvent type guard', () => {
    it('should return true for valid answer event with telnyx_call_control_id', () => {
      const event: AnswerEvent = {
        id: 12346,
        jsonrpc: '2.0',
        method: 'telnyx_rtc.answer',
        params: {
          callID: 'a2f31dd9-b9e6-403a-89d8-33767df14a56',
          dialogParams: { custom_headers: [] },
          sdp: 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n',
          variables: { 'Core-UUID': 'test-uuid' },
          telnyx_call_control_id: 'v3:mXnwxhjqOG0oDW6V6m7pEYGFCibIeNnsHQwvvUbqyADtTXKaX6uK4g',
          telnyx_leg_id: '04461b14-1885-11f1-87f2-02420aefba1f',
          telnyx_session_id: '044613a8-1885-11f1-87c4-02420aefba1f',
        },
        voice_sdk_id: 'VSDK1Ch8iUTpajWQf9DmIQHqdeNCIBdn5hw',
      };

      expect(isAnswerEvent(event)).toBe(true);
    });

    it('should return true for valid answer event without telnyx_call_control_id (backwards compatibility)', () => {
      const event = {
        id: 12346,
        jsonrpc: '2.0',
        method: 'telnyx_rtc.answer',
        params: {
          callID: 'a2f31dd9-b9e6-403a-89d8-33767df14a56',
          dialogParams: { custom_headers: [] },
          sdp: 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n',
          variables: { 'Core-UUID': 'test-uuid' },
        },
        voice_sdk_id: 'VSDK1Ch8iUTpajWQf9DmIQHqdeNCIBdn5hw',
      };

      expect(isAnswerEvent(event)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isAnswerEvent(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isAnswerEvent(undefined)).toBe(false);
    });

    it('should return false for event with wrong method', () => {
      const event = {
        id: 12346,
        jsonrpc: '2.0',
        method: 'telnyx_rtc.ringing',
        params: {
          callID: 'a2f31dd9-b9e6-403a-89d8-33767df14a56',
          sdp: 'v=0\r\n',
        },
        voice_sdk_id: 'VSDK1Ch8iUTpajWQf9DmIQHqdeNCIBdn5hw',
      };

      expect(isAnswerEvent(event)).toBe(false);
    });

    it('should return false for event without callID', () => {
      const event = {
        id: 12346,
        jsonrpc: '2.0',
        method: 'telnyx_rtc.answer',
        params: {
          dialogParams: { custom_headers: [] },
          sdp: 'v=0\r\n',
          variables: { 'Core-UUID': 'test-uuid' },
        },
        voice_sdk_id: 'VSDK1Ch8iUTpajWQf9DmIQHqdeNCIBdn5hw',
      };

      expect(isAnswerEvent(event)).toBe(false);
    });
  });

  describe('AnswerEvent type', () => {
    it('should allow telnyx_call_control_id to be optional', () => {
      const eventWithId: AnswerEvent = {
        id: 1,
        jsonrpc: '2.0',
        method: 'telnyx_rtc.answer',
        params: {
          callID: 'test-call-id',
          dialogParams: { custom_headers: [] },
          sdp: 'v=0\r\n',
          variables: { 'Core-UUID': 'test-uuid' },
          telnyx_call_control_id: 'v3:test-control-id',
          telnyx_leg_id: 'test-leg-id',
          telnyx_session_id: 'test-session-id',
        },
        voice_sdk_id: 'test-sdk-id',
      };

      const eventWithoutId: AnswerEvent = {
        id: 1,
        jsonrpc: '2.0',
        method: 'telnyx_rtc.answer',
        params: {
          callID: 'test-call-id',
          dialogParams: { custom_headers: [] },
          sdp: 'v=0\r\n',
          variables: { 'Core-UUID': 'test-uuid' },
        },
        voice_sdk_id: 'test-sdk-id',
      };

      expect(eventWithId.params.telnyx_call_control_id).toBe('v3:test-control-id');
      expect(eventWithoutId.params.telnyx_call_control_id).toBeUndefined();
    });

    it('should correctly type telnyx_leg_id and telnyx_session_id as optional', () => {
      const event: AnswerEvent = {
        id: 1,
        jsonrpc: '2.0',
        method: 'telnyx_rtc.answer',
        params: {
          callID: 'test-call-id',
          dialogParams: { custom_headers: [] },
          sdp: 'v=0\r\n',
          variables: { 'Core-UUID': 'test-uuid' },
          telnyx_leg_id: 'test-leg-id',
        },
        voice_sdk_id: 'test-sdk-id',
      };

      expect(event.params.telnyx_leg_id).toBe('test-leg-id');
      expect(event.params.telnyx_session_id).toBeUndefined();
    });
  });
});
