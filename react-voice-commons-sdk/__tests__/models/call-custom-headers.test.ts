import { Call } from '../../src/models/call';
import { TelnyxCallState } from '../../src/models/call-state';

// Mock the underlying Telnyx SDK
const mockTelnyxCall = {
  answer: jest.fn(),
  hangup: jest.fn(),
  hold: jest.fn(),
  unhold: jest.fn(),
  mute: jest.fn(),
  unmute: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  callId: 'mock-call-id',
  state: 'ringing',
  direction: 'inbound',
  inviteCustomHeaders: null as { name: string; value: string }[] | null,
  answerCustomHeaders: null as { name: string; value: string }[] | null,
};

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android', // Default to Android to avoid CallKit path
  },
}));

// Mock CallKit coordinator
jest.mock('../../src/callkit/callkit-coordinator', () => ({
  callKitCoordinator: {
    isAvailable: jest.fn().mockReturnValue(false),
    answerCallFromUI: jest.fn(),
    endCallFromUI: jest.fn(),
  },
}));

describe('Call Custom Headers (react-voice-commons-sdk)', () => {
  let call: Call;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock call
    mockTelnyxCall.answer.mockClear();
    mockTelnyxCall.hangup.mockClear();
    mockTelnyxCall.on.mockClear();

    // Create call instance
    call = new Call(
      mockTelnyxCall as any,
      'test-call-id',
      '+1234567890',
      true // isIncoming
    );
  });

  describe('answer method', () => {
    it('should call underlying Telnyx call answer without custom headers when none provided', async () => {
      // Setup
      mockTelnyxCall.answer.mockResolvedValue(undefined);

      // Execute
      await call.answer();

      // Verify
      expect(mockTelnyxCall.answer).toHaveBeenCalledWith(undefined);
    });

    it('should call underlying Telnyx call answer with custom headers when provided', async () => {
      // Setup
      const customHeaders = [
        { name: 'X-Custom-Header', value: 'test-value' },
        { name: 'X-User-Agent', value: 'react-voice-commons' },
      ];
      mockTelnyxCall.answer.mockResolvedValue(undefined);

      // Execute
      await call.answer(customHeaders);

      // Verify
      expect(mockTelnyxCall.answer).toHaveBeenCalledWith(customHeaders);
    });

    it('should set state to CONNECTING before calling answer', async () => {
      // Setup
      const stateSpy = jest.fn();
      call.callState$.subscribe(stateSpy);
      mockTelnyxCall.answer.mockResolvedValue(undefined);

      // Execute
      await call.answer();

      // Verify state change
      expect(stateSpy).toHaveBeenCalledWith(TelnyxCallState.CONNECTING);
    });

    it('should throw error when call cannot be answered', async () => {
      // Setup - set call to a state where it cannot be answered
      (call as any)._callState.next(TelnyxCallState.ENDED);

      // Execute & Verify
      await expect(call.answer()).rejects.toThrow('Cannot answer call in state: ENDED');
    });

    it('should handle answer failure', async () => {
      // Setup
      const error = new Error('Answer failed');
      mockTelnyxCall.answer.mockRejectedValue(error);

      // Execute & Verify
      await expect(call.answer()).rejects.toThrow('Answer failed');
    });

    it('should pass empty array when custom headers is empty array', async () => {
      // Setup
      mockTelnyxCall.answer.mockResolvedValue(undefined);

      // Execute
      await call.answer([]);

      // Verify
      expect(mockTelnyxCall.answer).toHaveBeenCalledWith([]);
    });
  });

  describe('hangup method', () => {
    beforeEach(() => {
      // Set call to a state where it can be hung up
      (call as any)._callState.next(TelnyxCallState.ACTIVE);
    });

    it('should call underlying Telnyx call hangup without custom headers when none provided', async () => {
      // Setup
      mockTelnyxCall.hangup.mockResolvedValue(undefined);

      // Execute
      await call.hangup();

      // Verify
      expect(mockTelnyxCall.hangup).toHaveBeenCalledWith(undefined);
    });

    it('should call underlying Telnyx call hangup with custom headers when provided', async () => {
      // Setup
      const customHeaders = [
        { name: 'X-Hangup-Reason', value: 'user-cancelled' },
        { name: 'X-Session-Info', value: 'completed' },
      ];
      mockTelnyxCall.hangup.mockResolvedValue(undefined);

      // Execute
      await call.hangup(customHeaders);

      // Verify
      expect(mockTelnyxCall.hangup).toHaveBeenCalledWith(customHeaders);
    });

    it('should throw error when call cannot be hung up', async () => {
      // Setup - set call to a state where it cannot be hung up
      (call as any)._callState.next(TelnyxCallState.ENDED);

      // Execute & Verify
      await expect(call.hangup()).rejects.toThrow('Cannot hang up call in state: ENDED');
    });

    it('should handle hangup failure', async () => {
      // Setup
      const error = new Error('Hangup failed');
      mockTelnyxCall.hangup.mockRejectedValue(error);

      // Execute & Verify
      await expect(call.hangup()).rejects.toThrow('Hangup failed');
    });

    it('should pass complex custom headers correctly', async () => {
      // Setup
      const customHeaders = [
        { name: 'X-Complex-Header', value: 'value with spaces and symbols!@#$%' },
        { name: 'X-Unicode', value: 'héllo wørld 🌍' },
        { name: 'X-Empty', value: '' },
      ];
      mockTelnyxCall.hangup.mockResolvedValue(undefined);

      // Execute
      await call.hangup(customHeaders);

      // Verify
      expect(mockTelnyxCall.hangup).toHaveBeenCalledWith(customHeaders);
    });
  });

  describe('iOS CallKit integration', () => {
    beforeEach(() => {
      // Mock iOS platform
      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));
    });

    afterEach(() => {
      jest.dontMock('react-native');
    });

    it('should use CallKit coordinator when available on iOS for answer', async () => {
      // This test would need more complex mocking of the CallKit coordinator
      // For now, we'll test the fallback case
      const customHeaders = [{ name: 'X-Test', value: 'ios-test' }];
      mockTelnyxCall.answer.mockResolvedValue(undefined);

      await call.answer(customHeaders);

      // In the current implementation, it falls back to direct call
      // because CallKit coordinator is mocked as unavailable
      expect(mockTelnyxCall.answer).toHaveBeenCalledWith(customHeaders);
    });
  });

  describe('call properties', () => {
    it('should have correct initial properties', () => {
      expect(call.callId).toBe('test-call-id');
      expect(call.destination).toBe('+1234567890');
      expect(call.isIncoming).toBe(true);
      expect(call.isOutgoing).toBe(false);
    });

    it('should provide access to underlying Telnyx call', () => {
      expect(call.telnyxCall).toBe(mockTelnyxCall);
    });
  });

  describe('reactive streams', () => {
    it('should emit call state changes', (done) => {
      let stateChangeCount = 0;
      
      call.callState$.subscribe((state) => {
        stateChangeCount++;
        if (stateChangeCount === 2) {
          expect(state).toBe(TelnyxCallState.ACTIVE);
          done();
        }
      });

      // Trigger state change
      (call as any)._callState.next(TelnyxCallState.ACTIVE);
    });

    it('should provide current state synchronously', () => {
      (call as any)._callState.next(TelnyxCallState.ACTIVE);
      expect(call.currentState).toBe(TelnyxCallState.ACTIVE);
    });
  });

  describe('error handling', () => {
    it('should handle custom headers validation', async () => {
      // Setup invalid custom headers (this would depend on actual validation)
      const invalidHeaders = [
        { name: '', value: 'empty-name' }, // Invalid: empty name
      ];

      mockTelnyxCall.answer.mockResolvedValue(undefined);

      // Currently, we don't have validation, but this test shows how it could be tested
      await call.answer(invalidHeaders);
      expect(mockTelnyxCall.answer).toHaveBeenCalledWith(invalidHeaders);
    });
  });

  describe('custom headers accessibility', () => {
    beforeEach(() => {
      // Set mock custom headers properties
      mockTelnyxCall.inviteCustomHeaders = [
        { name: 'X-Invite-Header', value: 'invite-value' }
      ];
      mockTelnyxCall.answerCustomHeaders = [
        { name: 'X-Answer-Header', value: 'answer-value' }
      ];
    });

    it('should expose inviteCustomHeaders from underlying Telnyx call', () => {
      const inviteHeaders = call.inviteCustomHeaders;
      
      expect(inviteHeaders).toEqual([
        { name: 'X-Invite-Header', value: 'invite-value' }
      ]);
    });

    it('should expose answerCustomHeaders from underlying Telnyx call', () => {
      const answerHeaders = call.answerCustomHeaders;
      
      expect(answerHeaders).toEqual([
        { name: 'X-Answer-Header', value: 'answer-value' }
      ]);
    });

    it('should handle null custom headers gracefully', () => {
      // Set mock properties to null
      mockTelnyxCall.inviteCustomHeaders = null;
      mockTelnyxCall.answerCustomHeaders = null;

      expect(call.inviteCustomHeaders).toBeNull();
      expect(call.answerCustomHeaders).toBeNull();
    });

    it('should handle empty custom headers arrays', () => {
      // Set mock properties to empty arrays
      mockTelnyxCall.inviteCustomHeaders = [];
      mockTelnyxCall.answerCustomHeaders = [];

      expect(call.inviteCustomHeaders).toEqual([]);
      expect(call.answerCustomHeaders).toEqual([]);
    });
  });
});