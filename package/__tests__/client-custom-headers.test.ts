import { TelnyxRTC } from '../lib/client';

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
  const callKitUUID = 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE';
  const actionKey = callKitUUID.toLowerCase();
  let client: TelnyxRTC;
  let mockCall: any;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new TelnyxRTC({ logLevel: 'debug' });
    mockCall = {
      callId: 'signaling-call-id',
      _callKitUUID: callKitUUID,
      answer: jest.fn().mockResolvedValue(undefined),
      hangup: jest.fn(),
      state: 'ringing',
    };
  });

  describe('queueAnswerFromCallKit', () => {
    it('stores custom headers under the normalized CallKit UUID', () => {
      const customHeaders = {
        'X-CallKit-Answer': 'true',
        'X-User-Action': 'answered-from-notification',
      };

      client.queueAnswerFromCallKit(callKitUUID, customHeaders);

      expect((client as any).pendingAnswerActions.get(actionKey)).toEqual(customHeaders);
      expect((client as any).pendingAnswerActions.size).toBe(1);
    });

    it('executes immediately against the matching CallKit UUID', async () => {
      (client as any).calls.set(mockCall.callId, mockCall);

      client.queueAnswerFromCallKit(callKitUUID, { 'X-Immediate': 'true' });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockCall.answer).toHaveBeenCalledWith([{ name: 'X-Immediate', value: 'true' }]);
      expect((client as any).pendingAnswerActions.has(actionKey)).toBe(false);
    });

    it('stores empty headers for a UUID-keyed answer', () => {
      client.queueAnswerFromCallKit(callKitUUID, {});

      expect((client as any).pendingAnswerActions.get(actionKey)).toEqual({});
    });

    it('keeps the legacy no-UUID form as an unambiguous empty-header action', () => {
      client.queueAnswerFromCallKit();

      expect((client as any).pendingAnswerActions.get('__legacy_unambiguous_call__')).toEqual({});
    });
  });

  describe('executePendingAnswer', () => {
    it('converts Record<string, string> to header array format', async () => {
      (client as any).pendingAnswerActions.set(actionKey, {
        'X-Header-1': 'value1',
        'X-Header-2': 'value2',
      });

      await (client as any).executePendingAnswer(mockCall, actionKey);

      expect(mockCall.answer).toHaveBeenCalledWith([
        { name: 'X-Header-1', value: 'value1' },
        { name: 'X-Header-2', value: 'value2' },
      ]);
    });

    it('removes only the completed UUID-keyed action after success', async () => {
      const otherKey = 'ffffffff-1111-2222-3333-444444444444';
      (client as any).pendingAnswerActions.set(actionKey, { 'X-Test': 'value' });
      (client as any).pendingAnswerActions.set(otherKey, { 'X-Other': 'value' });

      await (client as any).executePendingAnswer(mockCall, actionKey);

      expect((client as any).pendingAnswerActions.has(actionKey)).toBe(false);
      expect((client as any).pendingAnswerActions.get(otherKey)).toEqual({
        'X-Other': 'value',
      });
    });

    it('removes the UUID-keyed action after answer failure', async () => {
      mockCall.answer.mockRejectedValue(new Error('Answer failed'));
      (client as any).pendingAnswerActions.set(actionKey, { 'X-Test': 'value' });

      await (client as any).executePendingAnswer(mockCall, actionKey);

      expect((client as any).pendingAnswerActions.has(actionKey)).toBe(false);
    });

    it('handles an empty custom-header object', async () => {
      (client as any).pendingAnswerActions.set(actionKey, {});

      await (client as any).executePendingAnswer(mockCall, actionKey);

      expect(mockCall.answer).toHaveBeenCalledWith([]);
    });

    it('does not execute when the requested UUID has no pending answer', async () => {
      await (client as any).executePendingAnswer(mockCall, actionKey);

      expect(mockCall.answer).not.toHaveBeenCalled();
    });

    it('preserves special characters in header values', async () => {
      (client as any).pendingAnswerActions.set(actionKey, {
        'X-Special-Chars': 'value with spaces & symbols!@#$%^&*()',
        'X-Unicode': 'héllo wørld 🌍',
        'X-Empty': '',
      });

      await (client as any).executePendingAnswer(mockCall, actionKey);

      expect(mockCall.answer).toHaveBeenCalledWith([
        { name: 'X-Special-Chars', value: 'value with spaces & symbols!@#$%^&*()' },
        { name: 'X-Unicode', value: 'héllo wørld 🌍' },
        { name: 'X-Empty', value: '' },
      ]);
    });
  });

  describe('UUID-keyed pending action replacement', () => {
    it('replaces an answer with an end action only for the same UUID', () => {
      const otherKey = 'ffffffff-1111-2222-3333-444444444444';
      (client as any).pendingAnswerActions.set(otherKey, { 'X-Other': 'value' });
      client.queueAnswerFromCallKit(callKitUUID, { 'X-Test': 'value' });

      client.queueEndFromCallKit(callKitUUID);

      expect((client as any).pendingAnswerActions.has(actionKey)).toBe(false);
      expect((client as any).pendingEndActions.has(actionKey)).toBe(true);
      expect((client as any).pendingAnswerActions.has(otherKey)).toBe(true);
    });
  });

  describe('integration with invite processing', () => {
    it('retains UUID-keyed custom headers until the matching invite arrives', () => {
      const customHeaders = { 'X-Push-Answer': 'true' };

      client.queueAnswerFromCallKit(callKitUUID, customHeaders);

      expect((client as any).pendingAnswerActions.get(actionKey)).toEqual(customHeaders);
    });
  });
});
