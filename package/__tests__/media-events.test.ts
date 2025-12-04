import { TelnyxRTC } from '../lib/client';
import { isMediaEvent, createMediaMessage } from '../lib/messages/media';
import type { MediaEvent } from '../lib/messages/media';

// Mock dependencies
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock('../lib/connection');
jest.mock('../lib/login-handler');
jest.mock('../lib/keep-alive-handler');

describe('Media Event Handling', () => {
  let client: TelnyxRTC;
  let mockCall: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock call
    mockCall = {
      callId: 'test-call-id',
      handleEarlyMedia: jest.fn(),
      handleMediaUpdate: jest.fn(),
      handleRemoteAnswer: jest.fn(),
      setActive: jest.fn(),
      answerCustomHeaders: null,
      direction: 'outbound',
    };

    // Create client instance
    client = new TelnyxRTC({
      logLevel: 'debug',
    });
  });

  describe('isMediaEvent', () => {
    it('should correctly identify valid media events', () => {
      const validMediaEvent: MediaEvent = {
        id: '123',
        jsonrpc: '2.0',
        method: 'telnyx_rtc.media',
        params: {
          callID: 'test-call-id',
          audio: true,
          video: false,
          target: 'remote',
        },
      };

      expect(isMediaEvent(validMediaEvent)).toBe(true);
    });

    it('should correctly identify media events with SDP', () => {
      const mediaEventWithSDP: MediaEvent = {
        id: '123',
        jsonrpc: '2.0',
        method: 'telnyx_rtc.media',
        params: {
          callID: 'test-call-id',
          sdp: 'v=0\r\no=- 123456789 123456789 IN IP4 192.168.1.1\r\n...',
          audio: true,
          target: 'remote',
        },
      };

      expect(isMediaEvent(mediaEventWithSDP)).toBe(true);
    });

    it('should reject invalid media events', () => {
      expect(isMediaEvent(null)).toBe(false);
      expect(isMediaEvent(undefined)).toBe(false);
      expect(isMediaEvent({})).toBe(false);
      expect(isMediaEvent({ method: 'telnyx_rtc.invite' })).toBe(false);
      expect(isMediaEvent({ method: 'telnyx_rtc.media' })).toBe(false); // missing params
      expect(isMediaEvent({ 
        method: 'telnyx_rtc.media', 
        params: {} 
      })).toBe(false); // missing callID
    });
  });

  describe('createMediaMessage', () => {
    it('should create valid media message with all parameters', () => {
      const message = createMediaMessage({
        callID: 'test-call-id',
        audio: true,
        video: false,
        target: 'local',
      });

      expect(message).toEqual({
        id: expect.any(Number),
        jsonrpc: '2.0',
        method: 'telnyx_rtc.media',
        params: {
          callID: 'test-call-id',
          audio: true,
          video: false,
          target: 'local',
        },
      });
    });

    it('should create media message with minimal parameters', () => {
      const message = createMediaMessage({
        callID: 'test-call-id',
      });

      expect(message).toEqual({
        id: expect.any(Number),
        jsonrpc: '2.0',
        method: 'telnyx_rtc.media',
        params: {
          callID: 'test-call-id',
          target: 'remote', // default value
        },
      });
    });
  });

  describe('Media Event Processing', () => {
    it('should emit media event when received', () => {
      const mediaEvent: MediaEvent = {
        id: '123',
        jsonrpc: '2.0',
        method: 'telnyx_rtc.media',
        params: {
          callID: 'test-call-id',
          audio: false,
          target: 'remote',
        },
      };

      const eventSpy = jest.fn();
      client.on('telnyx.media.received', eventSpy);

      // Simulate receiving a media event
      (client as any).handleMediaEvent(mediaEvent);

      expect(eventSpy).toHaveBeenCalledWith(mediaEvent);
    });

    it('should handle media event without active call', () => {
      const mediaEvent: MediaEvent = {
        id: '123',
        jsonrpc: '2.0',
        method: 'telnyx_rtc.media',
        params: {
          callID: 'non-existent-call-id',
          audio: false,
          target: 'remote',
        },
      };

      const eventSpy = jest.fn();
      client.on('telnyx.media.received', eventSpy);

      // This should not throw an error even without an active call
      expect(() => {
        (client as any).handleMediaEvent(mediaEvent);
      }).not.toThrow();

      expect(eventSpy).toHaveBeenCalledWith(mediaEvent);
    });

    it('should store pending media event for later processing', () => {
      const mediaEvent: MediaEvent = {
        id: '123',
        jsonrpc: '2.0',
        method: 'telnyx_rtc.media',
        params: {
          callID: 'test-call-id',
          sdp: 'v=0\r\no=- 123456789 123456789 IN IP4 192.168.1.1\r\n...',
          audio: true,
          target: 'remote',
        },
      };

      // Handle media event without active call
      (client as any).handleMediaEvent(mediaEvent);

      // Verify the media event is stored in pending events
      const pendingEvents = (client as any).pendingMediaEvents;
      expect(pendingEvents.get('test-call-id')).toEqual(mediaEvent);
    });

    it('should process media event with active call', () => {
      // Set active call
      (client as any).call = mockCall;

      const mediaEvent: MediaEvent = {
        id: '123',
        jsonrpc: '2.0',
        method: 'telnyx_rtc.media',
        params: {
          callID: 'test-call-id',
          sdp: 'v=0\r\no=- 123456789 123456789 IN IP4 192.168.1.1\r\n...',
          audio: true,
          video: false,
          target: 'remote',
        },
      };

      const eventSpy = jest.fn();
      client.on('telnyx.media.received', eventSpy);

      // Handle media event
      (client as any).handleMediaEvent(mediaEvent);

      // Verify handleEarlyMedia was called with SDP
      expect(mockCall.handleEarlyMedia).toHaveBeenCalledWith('v=0\r\no=- 123456789 123456789 IN IP4 192.168.1.1\r\n...');

      // Verify handleMediaUpdate was called
      expect(mockCall.handleMediaUpdate).toHaveBeenCalledWith({
        audio: true,
        video: false,
        target: 'remote',
      });

      // Verify event was emitted
      expect(eventSpy).toHaveBeenCalledWith(mediaEvent);
    });

    it('should handle media event with SDP only (no audio/video changes)', () => {
      (client as any).call = mockCall;

      const mediaEvent: MediaEvent = {
        id: '123',
        jsonrpc: '2.0',
        method: 'telnyx_rtc.media',
        params: {
          callID: 'test-call-id',
          sdp: 'v=0\r\no=- 987654321 987654321 IN IP4 192.168.1.2\r\n...',
          target: 'remote',
        },
      };

      (client as any).handleMediaEvent(mediaEvent);

      // Verify only handleEarlyMedia was called
      expect(mockCall.handleEarlyMedia).toHaveBeenCalledWith('v=0\r\no=- 987654321 987654321 IN IP4 192.168.1.2\r\n...');
      expect(mockCall.handleMediaUpdate).not.toHaveBeenCalled();
    });

    it('should handle media event with audio/video changes only (no SDP)', () => {
      (client as any).call = mockCall;

      const mediaEvent: MediaEvent = {
        id: '123',
        jsonrpc: '2.0',
        method: 'telnyx_rtc.media',
        params: {
          callID: 'test-call-id',
          audio: false,
          video: true,
          target: 'local',
        },
      };

      (client as any).handleMediaEvent(mediaEvent);

      // Verify only handleMediaUpdate was called
      expect(mockCall.handleMediaUpdate).toHaveBeenCalledWith({
        audio: false,
        video: true,
        target: 'local',
      });
      expect(mockCall.handleEarlyMedia).not.toHaveBeenCalled();
    });


  });

  describe('Answer Event Handling', () => {
    beforeEach(() => {
      // Mock connection
      (client as any).connection = {
        send: jest.fn(),
      };
    });

    it('should handle answer event with SDP', () => {
      const answerEvent = {
        id: '456',
        jsonrpc: '2.0',
        method: 'telnyx_rtc.answer',
        params: {
          callID: 'test-call-id',
          sdp: 'v=0\r\no=- answer123 answer123 IN IP4 192.168.1.4\r\n...',
          dialogParams: {
            custom_headers: [
              { name: 'X-Custom-Header', value: 'test-value' }
            ],
          },
        },
      };

      (client as any).call = mockCall;
      const eventSpy = jest.fn();
      client.on('telnyx.call.answered', eventSpy);

      // Handle answer event
      (client as any).handleCallAnswer(answerEvent);

      // Verify custom headers were stored
      expect(mockCall.answerCustomHeaders).toEqual([
        { name: 'X-Custom-Header', value: 'test-value' }
      ]);

      // Verify remote answer was processed
      expect(mockCall.handleRemoteAnswer).toHaveBeenCalledWith('v=0\r\no=- answer123 answer123 IN IP4 192.168.1.4\r\n...');

      // Verify call was set to active
      expect(mockCall.setActive).toHaveBeenCalled();

      // Verify event was emitted
      expect(eventSpy).toHaveBeenCalledWith(mockCall, answerEvent);

      // Verify ACK was sent
      expect((client as any).connection.send).toHaveBeenCalledWith({
        id: '456',
        jsonrpc: '2.0',
        result: { method: 'telnyx_rtc.answer' },
      });
    });

    it('should handle answer event without SDP', () => {
      const answerEvent = {
        id: '789',
        jsonrpc: '2.0',
        method: 'telnyx_rtc.answer',
        params: {
          callID: 'test-call-id',
          dialogParams: {},
        },
      };

      (client as any).call = mockCall;

      // Handle answer event
      (client as any).handleCallAnswer(answerEvent);

      // Verify handleRemoteAnswer was NOT called (no SDP)
      expect(mockCall.handleRemoteAnswer).not.toHaveBeenCalled();

      // Verify call was still set to active
      expect(mockCall.setActive).toHaveBeenCalled();

      // Verify empty custom headers
      expect(mockCall.answerCustomHeaders).toBeNull();
    });

    it('should handle answer event without active call', () => {
      const answerEvent = {
        id: '999',
        jsonrpc: '2.0',
        method: 'telnyx_rtc.answer',
        params: {
          callID: 'unknown-call-id',
          sdp: 'v=0\r\no=- unknown123 unknown123 IN IP4 192.168.1.5\r\n...',
        },
      };

      // No active call
      (client as any).call = null;

      const eventSpy = jest.fn();
      client.on('telnyx.call.answered', eventSpy);

      // Handle answer event - should not throw
      expect(() => {
        (client as any).handleCallAnswer(answerEvent);
      }).not.toThrow();

      // Verify event was NOT emitted (no call)
      expect(eventSpy).not.toHaveBeenCalled();

      // Verify ACK was still sent
      expect((client as any).connection.send).toHaveBeenCalledWith({
        id: '999',
        jsonrpc: '2.0',
        result: { method: 'telnyx_rtc.answer' },
      });
    });

    it('should handle answer event with callID mismatch', () => {
      const answerEvent = {
        id: '111',
        jsonrpc: '2.0',
        method: 'telnyx_rtc.answer',
        params: {
          callID: 'different-call-id',
          sdp: 'v=0\r\no=- mismatch123 mismatch123 IN IP4 192.168.1.6\r\n...',
        },
      };

      // Active call with different ID
      (client as any).call = { ...mockCall, callId: 'test-call-id' };

      // Handle answer event
      (client as any).handleCallAnswer(answerEvent);

      // Verify call methods were NOT called (ID mismatch)
      expect(mockCall.handleRemoteAnswer).not.toHaveBeenCalled();
      expect(mockCall.setActive).not.toHaveBeenCalled();
    });
  });

  describe('Integration Tests', () => {
    it('should handle media event followed by answer event (early media scenario)', () => {
      // First: Media event with SDP arrives (early media)
      const mediaEvent: MediaEvent = {
        id: '123',
        jsonrpc: '2.0',
        method: 'telnyx_rtc.media',
        params: {
          callID: 'test-call-id',
          sdp: 'v=0\r\no=- early123 early123 IN IP4 192.168.1.7\r\n...',
          audio: true,
          target: 'remote',
        },
      };

      (client as any).call = mockCall;
      (client as any).connection = { send: jest.fn() };

      // Handle media event
      (client as any).handleMediaEvent(mediaEvent);

      // Verify early media was processed
      expect(mockCall.handleEarlyMedia).toHaveBeenCalledWith('v=0\r\no=- early123 early123 IN IP4 192.168.1.7\r\n...');

      // Clear mock calls
      jest.clearAllMocks();

      // Second: Answer event without SDP arrives (SDP already handled)
      const answerEvent = {
        id: '456',
        jsonrpc: '2.0',
        method: 'telnyx_rtc.answer',
        params: {
          callID: 'test-call-id',
          dialogParams: {},
        },
      };

      // Handle answer event
      (client as any).handleCallAnswer(answerEvent);

      // Verify remote answer was NOT called (no SDP in answer)
      expect(mockCall.handleRemoteAnswer).not.toHaveBeenCalled();

      // Verify call was set to active
      expect(mockCall.setActive).toHaveBeenCalled();
    });

    it('should handle answer event with SDP when no media event occurred', () => {
      const answerEvent = {
        id: '789',
        jsonrpc: '2.0',
        method: 'telnyx_rtc.answer',
        params: {
          callID: 'test-call-id',
          sdp: 'v=0\r\no=- direct123 direct123 IN IP4 192.168.1.8\r\n...',
        },
      };

      (client as any).call = mockCall;
      (client as any).connection = { send: jest.fn() };

      // Handle answer event directly
      (client as any).handleCallAnswer(answerEvent);

      // Verify remote answer was processed
      expect(mockCall.handleRemoteAnswer).toHaveBeenCalledWith('v=0\r\no=- direct123 direct123 IN IP4 192.168.1.8\r\n...');

      // Verify call was set to active
      expect(mockCall.setActive).toHaveBeenCalled();
    });
  });
});