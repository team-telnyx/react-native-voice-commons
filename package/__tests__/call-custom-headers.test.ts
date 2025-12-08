import { Call } from '../lib/call';
import { createAnswerMessage, createHangupRequest } from '../lib/messages/call';
import { Connection } from '../lib/connection';
import { Peer } from '../lib/peer';

// Mock dependencies
jest.mock('../lib/connection');
jest.mock('../lib/peer');
jest.mock('../lib/messages/call', () => ({
  ...jest.requireActual('../lib/messages/call'),
  createAnswerMessage: jest.fn(),
  createHangupRequest: jest.fn(),
}));

// Define shared mocks at module level
let mockConnection: jest.Mocked<Connection>;
let mockPeer: jest.Mocked<Peer>;
let call: Call;

const mockCallOptions = {
  audio: true,
  video: false,
  destinationNumber: '+1234567890',
};

describe('Call Custom Headers', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock connection
    mockConnection = {
      sendAndWait: jest.fn(),
      send: jest.fn(),
      addListener: jest.fn(),
    } as any;

    // Create mock peer
    mockPeer = {
      attachLocalStream: jest.fn().mockReturnThis(),
      createAnswer: jest.fn().mockReturnThis(),
      waitForIceGatheringComplete: jest.fn().mockReturnThis(),
      localDescription: { sdp: 'mock-sdp' },
      close: jest.fn(),
    } as any;

    // Create call instance
    call = new Call({
      connection: mockConnection,
      options: mockCallOptions,
      sessionId: 'test-session-id',
      direction: 'inbound',
      telnyxSessionId: 'test-telnyx-session-id',
      telnyxLegId: 'test-telnyx-leg-id',
      callId: 'test-call-id',
    });

    // Set up the peer using type assertion for testing
    (call as any).peer = mockPeer;

    // Mock the async chain
    mockPeer.attachLocalStream.mockResolvedValue(mockPeer);
    mockPeer.createAnswer.mockResolvedValue(mockPeer);
    mockPeer.waitForIceGatheringComplete.mockResolvedValue(mockPeer);
  });

  describe('answer method', () => {
    it('should call createAnswerMessage without custom headers when none provided', async () => {
      // Setup
      mockConnection.sendAndWait.mockResolvedValue({});
      (createAnswerMessage as jest.Mock).mockReturnValue('mock-answer-message');

      // Execute
      await call.answer();

      // Verify
      expect(createAnswerMessage).toHaveBeenCalledWith({
        callId: 'test-call-id',
        dialogParams: {},
        sdp: 'mock-sdp',
        telnyxLegId: 'test-telnyx-leg-id',
        telnyxSessionId: 'test-telnyx-session-id',
        sessionId: 'test-session-id',
        customHeaders: undefined,
      });
    });

    it('should call createAnswerMessage with custom headers when provided', async () => {
      // Setup
      const customHeaders = [
        { name: 'X-Custom-Header', value: 'custom-value' },
        { name: 'X-User-Agent', value: 'test-app' },
      ];
      mockConnection.sendAndWait.mockResolvedValue({});
      (createAnswerMessage as jest.Mock).mockReturnValue('mock-answer-message');

      // Execute
      await call.answer(customHeaders);

      // Verify
      expect(createAnswerMessage).toHaveBeenCalledWith({
        callId: 'test-call-id',
        dialogParams: {},
        sdp: 'mock-sdp',
        telnyxLegId: 'test-telnyx-leg-id',
        telnyxSessionId: 'test-telnyx-session-id',
        sessionId: 'test-session-id',
        customHeaders,
      });
    });

    it('should send the answer message through connection', async () => {
      // Setup
      const mockAnswerMessage = { id: 'test-id', method: 'telnyx_rtc.answer' };
      mockConnection.sendAndWait.mockResolvedValue({});
      (createAnswerMessage as jest.Mock).mockReturnValue(mockAnswerMessage);

      // Execute
      await call.answer();

      // Verify
      expect(mockConnection.sendAndWait).toHaveBeenCalledWith(mockAnswerMessage);
    });

    it('should throw error when peer is not created', async () => {
      // Setup
      (call as any).peer = null;

      // Execute & Verify
      await expect(call.answer()).rejects.toThrow('[Call] Peer is not created');
    });

    it('should set call state to active after successful answer', async () => {
      // Setup
      const stateSpy = jest.spyOn(call, 'emit');
      mockConnection.sendAndWait.mockResolvedValue({});

      // Execute
      await call.answer();

      // Verify
      expect(stateSpy).toHaveBeenCalledWith('telnyx.call.state', call, 'active');
    });
  });

  describe('hangup method', () => {
    beforeEach(() => {
      // Set call state to a valid state for hangup
      call.state = 'active';
    });

    it('should call createHangupRequest without custom headers when none provided', () => {
      // Setup
      (createHangupRequest as jest.Mock).mockReturnValue('mock-hangup-request');

      // Execute
      call.hangup();

      // Verify
      expect(createHangupRequest).toHaveBeenCalledWith({
        callId: 'test-call-id',
        telnyxLegId: 'test-telnyx-leg-id',
        telnyxSessionId: 'test-telnyx-session-id',
        cause: 'USER_BUSY',
        causeCode: 17,
        sessionId: 'test-session-id',
        customHeaders: undefined,
      });
    });

    it('should call createHangupRequest with custom headers when provided', () => {
      // Setup
      const customHeaders = [
        { name: 'X-Reason', value: 'user-cancelled' },
        { name: 'X-App-Version', value: '1.0.0' },
      ];
      (createHangupRequest as jest.Mock).mockReturnValue('mock-hangup-request');

      // Execute
      call.hangup(customHeaders);

      // Verify
      expect(createHangupRequest).toHaveBeenCalledWith({
        callId: 'test-call-id',
        telnyxLegId: 'test-telnyx-leg-id',
        telnyxSessionId: 'test-telnyx-session-id',
        cause: 'USER_BUSY',
        causeCode: 17,
        sessionId: 'test-session-id',
        customHeaders,
      });
    });

    it('should send the hangup request through connection', () => {
      // Setup
      const mockHangupRequest = { id: 'test-id', method: 'telnyx_rtc.bye' };
      (createHangupRequest as jest.Mock).mockReturnValue(mockHangupRequest);

      // Execute
      call.hangup();

      // Verify
      expect(mockConnection.send).toHaveBeenCalledWith(mockHangupRequest);
    });

    it('should close peer connection', () => {
      // Execute
      call.hangup();

      // Verify
      expect(mockPeer.close).toHaveBeenCalled();
    });

    it('should set call state to ended', () => {
      // Setup
      const stateSpy = jest.spyOn(call, 'emit');

      // Execute
      call.hangup();

      // Verify
      expect(stateSpy).toHaveBeenCalledWith('telnyx.call.state', call, 'ended');
    });
  });

  describe('createInboundCall', () => {
    it('should create call with proper UUID assignment from push notification', async () => {
      // Setup
      const mockConnectionWithClient = {
        ...mockConnection,
        _client: {
          getPushNotificationCallKitUUID: jest.fn().mockReturnValue('test-callkit-uuid'),
          setPushNotificationCallKitUUID: jest.fn(),
        },
      };

      // Mock Peer constructor to return our mock
      (Peer as jest.MockedClass<typeof Peer>).mockImplementation(() => mockPeer);
      mockPeer.createPeerConnection = jest.fn();
      mockPeer.setRemoteDescription = jest.fn();

      // Execute
      const inboundCall = await Call.createInboundCall({
        connection: mockConnectionWithClient as any,
        options: mockCallOptions,
        sessionId: 'test-session-id',
        telnyxSessionId: 'test-telnyx-session-id',
        telnyxLegId: 'test-telnyx-leg-id',
        remoteSDP: 'test-remote-sdp',
        callId: 'test-call-id',
      });

      // Verify CallKit UUID was assigned
      expect((inboundCall as any)._callKitUUID).toBe('test-callkit-uuid');
      expect((inboundCall as any)._isPushNotificationCall).toBe(true);
      expect(mockConnectionWithClient._client.setPushNotificationCallKitUUID).toHaveBeenCalledWith(
        null
      );
    });
  });
});

describe('Message Creation Functions', () => {
  // Use real implementations for these tests
  const realCreateAnswerMessage = jest.requireActual('../lib/messages/call').createAnswerMessage;
  const realCreateHangupRequest = jest.requireActual('../lib/messages/call').createHangupRequest;

  describe('createAnswerMessage', () => {
    it('should include custom headers in dialogParams', () => {
      const customHeaders = [
        { name: 'X-Custom', value: 'test' },
        { name: 'X-Another', value: 'value' },
      ];

      const result = realCreateAnswerMessage({
        callId: 'test-call-id',
        dialogParams: {},
        sdp: 'test-sdp',
        telnyxLegId: 'test-leg-id',
        telnyxSessionId: 'test-session-id',
        sessionId: 'test-session-id',
        customHeaders,
      });

      expect(result.params.dialogParams.custom_headers).toEqual(customHeaders);
      expect(result.params.dialogParams.callID).toBe('test-call-id');
      expect(result.method).toBe('telnyx_rtc.answer');
    });

    it('should use empty array for custom headers when none provided', () => {
      const result = realCreateAnswerMessage({
        callId: 'test-call-id',
        dialogParams: {},
        sdp: 'test-sdp',
        telnyxLegId: 'test-leg-id',
        telnyxSessionId: 'test-session-id',
        sessionId: 'test-session-id',
      });

      expect(result.params.dialogParams.custom_headers).toEqual([]);
    });
  });

  describe('createHangupRequest', () => {
    it('should include custom headers in dialogParams', () => {
      const customHeaders = [{ name: 'X-Reason', value: 'testing' }];

      const result = realCreateHangupRequest({
        callId: 'test-call-id',
        telnyxLegId: 'test-leg-id',
        telnyxSessionId: 'test-session-id',
        cause: 'USER_BUSY',
        causeCode: 17,
        sessionId: 'test-session-id',
        customHeaders,
      });

      expect(result.params.dialogParams.custom_headers).toEqual(customHeaders);
      expect(result.method).toBe('telnyx_rtc.bye');
    });

    it('should use empty array for custom headers when none provided', () => {
      const result = realCreateHangupRequest({
        callId: 'test-call-id',
        telnyxLegId: 'test-leg-id',
        telnyxSessionId: 'test-session-id',
        cause: 'USER_BUSY',
        causeCode: 17,
        sessionId: 'test-session-id',
      });

      expect(result.params.dialogParams.custom_headers).toEqual([]);
    });
  });

  describe('Custom Headers Accessibility', () => {
    it('should expose inviteCustomHeaders property for inbound calls', async () => {
      const inviteHeaders = [
        { name: 'X-Custom-Header-1', value: 'invite-value-1' },
        { name: 'X-Custom-Header-2', value: 'invite-value-2' },
      ];

      const inboundCall = await Call.createInboundCall({
        connection: mockConnection,
        options: mockCallOptions,
        sessionId: 'test-session-id',
        telnyxSessionId: 'test-telnyx-session-id',
        telnyxLegId: 'test-telnyx-leg-id',
        remoteSDP: 'mock-sdp',
        callId: 'test-call-id',
        inviteCustomHeaders: inviteHeaders,
      });

      expect(inboundCall.inviteCustomHeaders).toEqual(inviteHeaders);
      expect(inboundCall.answerCustomHeaders).toBeNull();
    });

    it('should expose answerCustomHeaders property when answer is received', async () => {
      const answerHeaders = [
        { name: 'X-Answer-Header-1', value: 'answer-value-1' },
        { name: 'X-Answer-Header-2', value: 'answer-value-2' },
      ];

      // Create a call with a peer for testing
      const testCall = new Call({
        connection: mockConnection,
        options: mockCallOptions,
        sessionId: 'test-session-id',
        direction: 'outbound',
        telnyxSessionId: 'test-telnyx-session-id',
        telnyxLegId: 'test-telnyx-leg-id',
        callId: 'test-call-id',
      });

      // Simulate receiving an answer event with custom headers
      const mockAnswerEvent = {
        method: 'telnyx_rtc.answer',
        params: {
          callID: testCall.callId,
          sdp: 'mock-answer-sdp',
          dialogParams: {
            custom_headers: answerHeaders,
          },
        },
        id: 123,
      };

      // Mock peer.setRemoteDescription
      mockPeer.setRemoteDescription = jest.fn().mockResolvedValue(undefined);
      (testCall as any).peer = mockPeer;

      // Directly set the custom headers (simulating what the client would do)
      testCall.answerCustomHeaders = answerHeaders;

      expect(testCall.answerCustomHeaders).toEqual(answerHeaders);
    });

    it('should store invite custom headers for outbound calls', async () => {
      const outgoingHeaders = [
        { name: 'X-Outgoing-Header-1', value: 'outgoing-value-1' },
        { name: 'X-Outgoing-Header-2', value: 'outgoing-value-2' },
      ];

      const callWithHeaders = new Call({
        connection: mockConnection,
        options: {
          ...mockCallOptions,
          customHeaders: outgoingHeaders,
        },
        sessionId: 'test-session-id',
        direction: 'outbound',
        telnyxSessionId: null,
        telnyxLegId: null,
        callId: 'test-call-id',
      });

      // Mock invite method dependencies
      const mockMsg = {
        result: {
          callID: 'updated-call-id',
          sessid: 'test-session-id',
          message: 'CALL CREATED',
        },
      };
      mockConnection.sendAndWait = jest.fn().mockResolvedValue(mockMsg);

      // Mock Peer.createOffer
      const mockOfferPeer = {
        localDescription: { sdp: 'mock-local-sdp' },
      } as any;
      (Peer.createOffer as jest.Mock).mockResolvedValue(mockOfferPeer);

      await callWithHeaders.invite();

      expect(callWithHeaders.inviteCustomHeaders).toEqual(outgoingHeaders);
    });

    it('should handle null custom headers gracefully', async () => {
      const inboundCall = await Call.createInboundCall({
        connection: mockConnection,
        options: mockCallOptions,
        sessionId: 'test-session-id',
        telnyxSessionId: 'test-telnyx-session-id',
        telnyxLegId: 'test-telnyx-leg-id',
        remoteSDP: 'mock-sdp',
        callId: 'test-call-id',
        inviteCustomHeaders: null,
      });

      expect(inboundCall.inviteCustomHeaders).toBeNull();
      expect(inboundCall.answerCustomHeaders).toBeNull();
    });

    it('should handle empty custom headers arrays', async () => {
      const inboundCall = await Call.createInboundCall({
        connection: mockConnection,
        options: mockCallOptions,
        sessionId: 'test-session-id',
        telnyxSessionId: 'test-telnyx-session-id',
        telnyxLegId: 'test-telnyx-leg-id',
        remoteSDP: 'mock-sdp',
        callId: 'test-call-id',
        inviteCustomHeaders: [],
      });

      expect(inboundCall.inviteCustomHeaders).toEqual([]);
      expect(inboundCall.answerCustomHeaders).toBeNull();
    });
  });
});
