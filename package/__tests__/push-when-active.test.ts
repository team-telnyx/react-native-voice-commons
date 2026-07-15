import { Call } from '../lib/call';
import { createAnswerMessage } from '../lib/messages/call';
import { Connection } from '../lib/connection';
import { Peer } from '../lib/peer';

// Mock dependencies
jest.mock('../lib/connection');
jest.mock('../lib/peer');
jest.mock('../lib/messages/call', () => ({
  ...jest.requireActual('../lib/messages/call'),
  createAnswerMessage: jest.fn(),
}));

// Define shared mocks at module level
let mockConnection: jest.Mocked<Connection>;
let mockPeer: jest.Mocked<Peer>;
let call: Call;

const mockCallOptions = {
  audio: true,
  video: false,
  destinationNumber: '+123****7890',
};

describe('pushWhenActive / answered_device_token', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockConnection = {
      sendAndWait: jest.fn(),
      send: jest.fn(),
      addListener: jest.fn(),
    } as any;

    mockPeer = {
      attachLocalStream: jest.fn().mockReturnThis(),
      createAnswer: jest.fn().mockReturnThis(),
      waitForIceGatheringComplete: jest.fn().mockReturnThis(),
      localDescription: { sdp: 'mock-sdp' },
      close: jest.fn(),
    } as any;

    mockPeer.attachLocalStream.mockResolvedValue(mockPeer);
    mockPeer.createAnswer.mockResolvedValue(mockPeer);
    mockPeer.waitForIceGatheringComplete.mockResolvedValue(mockPeer);
  });

  describe('createAnswerMessage function', () => {
    it('should include answered_device_token when answeredDeviceToken is provided', () => {
      const message = createAnswerMessage({
        dialogParams: {},
        sdp: 'mock-sdp',
        sessionId: 'test-session',
        callId: 'test-call-id',
        telnyxLegId: 'test-leg-id',
        telnyxSessionId: 'test-session-id',
        answeredDeviceToken: 'test-push-token',
      });

      expect(message.params.answered_device_token).toBe('test-push-token');
    });

    it('should NOT include answered_device_token when answeredDeviceToken is not provided', () => {
      const message = createAnswerMessage({
        dialogParams: {},
        sdp: 'mock-sdp',
        sessionId: 'test-session',
        callId: 'test-call-id',
        telnyxLegId: 'test-leg-id',
        telnyxSessionId: 'test-session-id',
      });

      expect(message.params.answered_device_token).toBeUndefined();
    });

    it('should NOT include answered_device_token when answeredDeviceToken is empty string', () => {
      const message = createAnswerMessage({
        dialogParams: {},
        sdp: 'mock-sdp',
        sessionId: 'test-session',
        callId: 'test-call-id',
        telnyxLegId: 'test-leg-id',
        telnyxSessionId: 'test-session-id',
        answeredDeviceToken: '',
      });

      expect(message.params.answered_device_token).toBeUndefined();
    });
  });

  describe('Call.answer with pushWhenActive', () => {
    it('should pass answeredDeviceToken when pushWhenActive is true and token is set', async () => {
      call = new Call({
        connection: mockConnection,
        options: mockCallOptions,
        sessionId: 'test-session-id',
        direction: 'inbound',
        telnyxSessionId: 'test-telnyx-session-id',
        telnyxLegId: 'test-telnyx-leg-id',
        callId: 'test-call-id',
        pushWhenActive: true,
        pushNotificationDeviceToken: 'test-device-token',
      });

      (call as any).peer = mockPeer;
      mockConnection.sendAndWait.mockResolvedValue({});
      (createAnswerMessage as jest.Mock).mockReturnValue('mock-answer-message');

      await call.answer();

      expect(createAnswerMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          answeredDeviceToken: 'test-device-token',
        })
      );
    });

    it('should NOT pass answeredDeviceToken when pushWhenActive is false', async () => {
      call = new Call({
        connection: mockConnection,
        options: mockCallOptions,
        sessionId: 'test-session-id',
        direction: 'inbound',
        telnyxSessionId: 'test-telnyx-session-id',
        telnyxLegId: 'test-telnyx-leg-id',
        callId: 'test-call-id',
        pushWhenActive: false,
        pushNotificationDeviceToken: 'test-device-token',
      });

      (call as any).peer = mockPeer;
      mockConnection.sendAndWait.mockResolvedValue({});
      (createAnswerMessage as jest.Mock).mockReturnValue('mock-answer-message');

      await call.answer();

      expect(createAnswerMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          answeredDeviceToken: undefined,
        })
      );
    });

    it('should NOT pass answeredDeviceToken when pushWhenActive is true but no token set', async () => {
      call = new Call({
        connection: mockConnection,
        options: mockCallOptions,
        sessionId: 'test-session-id',
        direction: 'inbound',
        telnyxSessionId: 'test-telnyx-session-id',
        telnyxLegId: 'test-telnyx-leg-id',
        callId: 'test-call-id',
        pushWhenActive: true,
        pushNotificationDeviceToken: '',
      });

      (call as any).peer = mockPeer;
      mockConnection.sendAndWait.mockResolvedValue({});
      (createAnswerMessage as jest.Mock).mockReturnValue('mock-answer-message');

      await call.answer();

      expect(createAnswerMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          answeredDeviceToken: undefined,
        })
      );
    });

    it('should NOT pass answeredDeviceToken when defaults are used (no push config)', async () => {
      call = new Call({
        connection: mockConnection,
        options: mockCallOptions,
        sessionId: 'test-session-id',
        direction: 'inbound',
        telnyxSessionId: 'test-telnyx-session-id',
        telnyxLegId: 'test-telnyx-leg-id',
        callId: 'test-call-id',
      });

      (call as any).peer = mockPeer;
      mockConnection.sendAndWait.mockResolvedValue({});
      (createAnswerMessage as jest.Mock).mockReturnValue('mock-answer-message');

      await call.answer();

      expect(createAnswerMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          answeredDeviceToken: undefined,
        })
      );
    });
  });
});
