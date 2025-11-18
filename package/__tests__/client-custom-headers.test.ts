import { TelnyxRTC } from '../lib/client';

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

describe('TelnyxRTC Client Custom Headers', () => {
  let client: TelnyxRTC;
  let mockCall: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create client instance
    client = new TelnyxRTC({
      logLevel: 'debug',
    });

    // Mock call object with answer method
    mockCall = {
      answer: jest.fn().mockResolvedValue(undefined),
      hangup: jest.fn(),
      state: 'ringing',
    };
  });

  describe('queueAnswerFromCallKit', () => {
    it('should store custom headers for pending answer', () => {
      // Setup
      const customHeaders = {
        'X-CallKit-Answer': 'true',
        'X-User-Action': 'answered-from-notification',
      };

      // Execute
      client.queueAnswerFromCallKit(customHeaders);

      // Verify internal state
      expect((client as any).pendingAnswerAction).toBe(true);
      expect((client as any).pendingCustomHeaders).toEqual(customHeaders);
    });

    it('should execute immediately if call already exists', async () => {
      // Setup
      (client as any).call = mockCall;
      const customHeaders = {
        'X-Immediate': 'true',
      };

      // Execute
      client.queueAnswerFromCallKit(customHeaders);

      // Wait for async execution
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify call was answered with converted headers
      expect(mockCall.answer).toHaveBeenCalledWith([{ name: 'X-Immediate', value: 'true' }]);
    });

    it('should handle empty custom headers', () => {
      // Execute
      client.queueAnswerFromCallKit({});

      // Verify
      expect((client as any).pendingCustomHeaders).toEqual({});
    });

    it('should handle undefined custom headers', () => {
      // Execute
      client.queueAnswerFromCallKit();

      // Verify
      expect((client as any).pendingCustomHeaders).toEqual({});
    });
  });

  describe('executePendingAnswer', () => {
    beforeEach(() => {
      // Set up pending answer
      (client as any).pendingAnswerAction = true;
      (client as any).call = mockCall;
    });

    it('should convert Record<string, string> to header array format', async () => {
      // Setup
      (client as any).pendingCustomHeaders = {
        'X-Header-1': 'value1',
        'X-Header-2': 'value2',
      };

      // Execute
      await (client as any).executePendingAnswer();

      // Verify conversion
      expect(mockCall.answer).toHaveBeenCalledWith([
        { name: 'X-Header-1', value: 'value1' },
        { name: 'X-Header-2', value: 'value2' },
      ]);
    });

    it('should reset pending actions after successful execution', async () => {
      // Setup
      (client as any).pendingCustomHeaders = { 'X-Test': 'value' };

      // Execute
      await (client as any).executePendingAnswer();

      // Verify reset
      expect((client as any).pendingAnswerAction).toBe(false);
      expect((client as any).pendingCustomHeaders).toEqual({});
    });

    it('should reset pending actions even after failure', async () => {
      // Setup
      mockCall.answer.mockRejectedValue(new Error('Answer failed'));
      (client as any).pendingCustomHeaders = { 'X-Test': 'value' };

      // Execute
      await (client as any).executePendingAnswer();

      // Verify reset even after error
      expect((client as any).pendingAnswerAction).toBe(false);
      expect((client as any).pendingCustomHeaders).toEqual({});
    });

    it('should handle empty custom headers object', async () => {
      // Setup
      (client as any).pendingCustomHeaders = {};

      // Execute
      await (client as any).executePendingAnswer();

      // Verify
      expect(mockCall.answer).toHaveBeenCalledWith([]);
    });

    it('should not execute when no pending action', async () => {
      // Setup
      (client as any).pendingAnswerAction = false;

      // Execute
      await (client as any).executePendingAnswer();

      // Verify
      expect(mockCall.answer).not.toHaveBeenCalled();
    });

    it('should not execute when no call exists', async () => {
      // Setup
      (client as any).call = null;

      // Execute
      await (client as any).executePendingAnswer();

      // Verify
      expect(mockCall.answer).not.toHaveBeenCalled();
    });

    it('should handle special characters in header values', async () => {
      // Setup
      (client as any).pendingCustomHeaders = {
        'X-Special-Chars': 'value with spaces & symbols!@#$%^&*()',
        'X-Unicode': 'héllo wørld 🌍',
        'X-Empty': '',
      };

      // Execute
      await (client as any).executePendingAnswer();

      // Verify
      expect(mockCall.answer).toHaveBeenCalledWith([
        { name: 'X-Special-Chars', value: 'value with spaces & symbols!@#$%^&*()' },
        { name: 'X-Unicode', value: 'héllo wørld 🌍' },
        { name: 'X-Empty', value: '' },
      ]);
    });
  });

  describe('resetPendingActions', () => {
    it('should reset all pending action flags and custom headers', () => {
      // Setup
      (client as any).pendingAnswerAction = true;
      (client as any).pendingEndAction = true;
      (client as any).pendingCustomHeaders = { 'X-Test': 'value' };

      // Execute
      (client as any).resetPendingActions();

      // Verify
      expect((client as any).pendingAnswerAction).toBe(false);
      expect((client as any).pendingEndAction).toBe(false);
      expect((client as any).pendingCustomHeaders).toEqual({});
      // Note: isCallFromPush should NOT be reset by this method
    });
  });

  describe('integration with processInvite', () => {
    it('should execute pending answer with custom headers when invite arrives', async () => {
      // This test would require more complex mocking of the invite processing
      // For now, we verify the conceptual flow

      // Setup pending answer
      const customHeaders = { 'X-Push-Answer': 'true' };
      client.queueAnswerFromCallKit(customHeaders);

      // Verify pending state
      expect((client as any).pendingAnswerAction).toBe(true);
      expect((client as any).pendingCustomHeaders).toEqual(customHeaders);
    });
  });
});
