import { createAnswerMessage, createHangupRequest } from '../lib/messages/call';

describe('Custom Headers Integration Tests', () => {
  describe('Answer Message Custom Headers', () => {
    it('should create proper answer message with custom headers', () => {
      const customHeaders = [
        { name: 'X-Custom-App', value: 'MyVoiceApp' },
        { name: 'X-User-ID', value: '12345' },
        { name: 'X-Session-Info', value: 'answered-via-push' },
      ];

      const message = createAnswerMessage({
        callId: 'call-123',
        dialogParams: { existing: 'param' },
        sdp: 'mock-sdp-data',
        telnyxLegId: 'leg-456',
        telnyxSessionId: 'session-789',
        sessionId: 'session-789',
        customHeaders,
      });

      // Verify structure
      expect(message.method).toBe('telnyx_rtc.answer');
      expect(message.params.sessid).toBe('session-789');
      expect(message.params.sdp).toBe('mock-sdp-data');

      // Verify dialog params
      expect(message.params.dialogParams.callID).toBe('call-123');
      expect(message.params.dialogParams.telnyxLegId).toBe('leg-456');
      expect(message.params.dialogParams.telnyxSessionId).toBe('session-789');
      expect(message.params.dialogParams.existing).toBe('param');

      // Verify custom headers are properly included
      expect(message.params.dialogParams.custom_headers).toEqual(customHeaders);

      // Verify User-Agent is set
      expect(message.params['User-Agent']).toMatch(/react-native-/);
    });

    it('should handle empty custom headers', () => {
      const message = createAnswerMessage({
        callId: 'call-123',
        dialogParams: {},
        sdp: 'mock-sdp',
        telnyxLegId: 'leg-456',
        telnyxSessionId: 'session-789',
        sessionId: 'session-789',
      });

      expect(message.params.dialogParams.custom_headers).toEqual([]);
    });

    it('should handle complex header values', () => {
      const customHeaders = [
        { name: 'X-JSON-Data', value: '{"key":"value","nested":{"prop":123}}' },
        { name: 'X-Special-Chars', value: 'Hello, World! @#$%^&*()_+ 测试' },
        { name: 'X-URL', value: 'https://example.com/path?param=value&other=test' },
        { name: 'X-Base64', value: 'SGVsbG8gV29ybGQ=' },
      ];

      const message = createAnswerMessage({
        callId: 'call-123',
        dialogParams: {},
        sdp: 'mock-sdp',
        telnyxLegId: 'leg-456',
        telnyxSessionId: 'session-789',
        sessionId: 'session-789',
        customHeaders,
      });

      expect(message.params.dialogParams.custom_headers).toEqual(customHeaders);
    });
  });

  describe('Hangup Request Custom Headers', () => {
    it('should create proper hangup request with custom headers', () => {
      const customHeaders = [
        { name: 'X-Hangup-Reason', value: 'user-ended' },
        { name: 'X-Call-Quality', value: 'excellent' },
        { name: 'X-Duration-Seconds', value: '120' },
      ];

      const request = createHangupRequest({
        callId: 'call-123',
        telnyxLegId: 'leg-456',
        telnyxSessionId: 'session-789',
        cause: 'USER_BUSY',
        causeCode: 17,
        sessionId: 'session-789',
        customHeaders,
      });

      // Verify structure
      expect(request.method).toBe('telnyx_rtc.bye');
      expect(request.params.sessid).toBe('session-789');
      expect(request.params.cause).toBe('USER_BUSY');
      expect(request.params.causeCode).toBe(17);

      // Verify dialog params
      expect(request.params.dialogParams.callID).toBe('call-123');
      expect(request.params.dialogParams.telnyxLegId).toBe('leg-456');
      expect(request.params.dialogParams.telnyxSessionId).toBe('session-789');

      // Verify custom headers
      expect(request.params.dialogParams.custom_headers).toEqual(customHeaders);
    });

    it('should use empty array when no custom headers provided', () => {
      const request = createHangupRequest({
        callId: 'call-123',
        telnyxLegId: 'leg-456',
        telnyxSessionId: 'session-789',
        cause: 'USER_BUSY',
        causeCode: 17,
        sessionId: 'session-789',
      });

      expect(request.params.dialogParams.custom_headers).toEqual([]);
    });
  });

  describe('End-to-End Header Flow', () => {
    it('should demonstrate complete custom headers lifecycle', () => {
      // Simulate a call flow with custom headers at each step

      // 1. Custom headers for answer
      const answerHeaders = [
        { name: 'X-Answer-Time', value: new Date().toISOString() },
        { name: 'X-Client-Version', value: '1.0.0' },
      ];

      const answerMessage = createAnswerMessage({
        callId: 'call-lifecycle-123',
        dialogParams: { flow: 'test' },
        sdp: 'answer-sdp',
        telnyxLegId: 'leg-lifecycle',
        telnyxSessionId: 'session-lifecycle',
        sessionId: 'session-lifecycle',
        customHeaders: answerHeaders,
      });

      // Verify answer message has headers
      expect(answerMessage.params.dialogParams.custom_headers).toEqual(answerHeaders);

      // 2. Custom headers for hangup
      const hangupHeaders = [
        { name: 'X-End-Time', value: new Date().toISOString() },
        { name: 'X-Call-Rating', value: '5' },
        { name: 'X-End-Reason', value: 'completed-successfully' },
      ];

      const hangupRequest = createHangupRequest({
        callId: 'call-lifecycle-123',
        telnyxLegId: 'leg-lifecycle',
        telnyxSessionId: 'session-lifecycle',
        cause: 'NORMAL_CLEARING',
        causeCode: 16,
        sessionId: 'session-lifecycle',
        customHeaders: hangupHeaders,
      });

      // Verify hangup request has different headers
      expect(hangupRequest.params.dialogParams.custom_headers).toEqual(hangupHeaders);

      // Verify they are independent
      expect(answerMessage.params.dialogParams.custom_headers).not.toEqual(
        hangupRequest.params.dialogParams.custom_headers
      );
    });
  });

  describe('Header Validation and Edge Cases', () => {
    it('should handle maximum length headers', () => {
      const longValue = 'x'.repeat(1000); // Very long header value
      const customHeaders = [{ name: 'X-Long-Header', value: longValue }];

      const message = createAnswerMessage({
        callId: 'call-123',
        dialogParams: {},
        sdp: 'mock-sdp',
        telnyxLegId: 'leg-456',
        telnyxSessionId: 'session-789',
        sessionId: 'session-789',
        customHeaders,
      });

      expect(message.params.dialogParams.custom_headers[0].value).toBe(longValue);
    });

    it('should handle many headers', () => {
      const manyHeaders = [];
      for (let i = 0; i < 50; i++) {
        manyHeaders.push({ name: `X-Header-${i}`, value: `value-${i}` });
      }

      const message = createAnswerMessage({
        callId: 'call-123',
        dialogParams: {},
        sdp: 'mock-sdp',
        telnyxLegId: 'leg-456',
        telnyxSessionId: 'session-789',
        sessionId: 'session-789',
        customHeaders: manyHeaders,
      });

      expect(message.params.dialogParams.custom_headers).toHaveLength(50);
      expect(message.params.dialogParams.custom_headers[0]).toEqual({
        name: 'X-Header-0',
        value: 'value-0',
      });
      expect(message.params.dialogParams.custom_headers[49]).toEqual({
        name: 'X-Header-49',
        value: 'value-49',
      });
    });

    it('should preserve header name casing', () => {
      const customHeaders = [
        { name: 'X-CamelCase-Header', value: 'test' },
        { name: 'x-lowercase-header', value: 'test' },
        { name: 'X-UPPERCASE-HEADER', value: 'test' },
        { name: 'X-MiXeD-cAsE-hEaDeR', value: 'test' },
      ];

      const message = createAnswerMessage({
        callId: 'call-123',
        dialogParams: {},
        sdp: 'mock-sdp',
        telnyxLegId: 'leg-456',
        telnyxSessionId: 'session-789',
        sessionId: 'session-789',
        customHeaders,
      });

      const headerNames = message.params.dialogParams.custom_headers.map((h) => h.name);
      expect(headerNames).toEqual([
        'X-CamelCase-Header',
        'x-lowercase-header',
        'X-UPPERCASE-HEADER',
        'X-MiXeD-cAsE-hEaDeR',
      ]);
    });
  });
});
