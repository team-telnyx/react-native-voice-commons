import { TelnyxCallState, isTelnyxCallState, CallStateHelpers } from '../../src/models/call-state';

describe('TelnyxCallState', () => {
  describe('isTelnyxCallState', () => {
    it('should return true for valid call states', () => {
      expect(isTelnyxCallState(TelnyxCallState.RINGING)).toBe(true);
      expect(isTelnyxCallState(TelnyxCallState.ACTIVE)).toBe(true);
      expect(isTelnyxCallState(TelnyxCallState.HELD)).toBe(true);
      expect(isTelnyxCallState(TelnyxCallState.ENDED)).toBe(true);
      expect(isTelnyxCallState(TelnyxCallState.FAILED)).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isTelnyxCallState('invalid')).toBe(false);
      expect(isTelnyxCallState(null)).toBe(false);
      expect(isTelnyxCallState(undefined)).toBe(false);
      expect(isTelnyxCallState(123)).toBe(false);
    });
  });

  describe('CallStateHelpers', () => {
    describe('canAnswer', () => {
      it('should return true only for RINGING state', () => {
        expect(CallStateHelpers.canAnswer(TelnyxCallState.RINGING)).toBe(true);
        expect(CallStateHelpers.canAnswer(TelnyxCallState.ACTIVE)).toBe(false);
        expect(CallStateHelpers.canAnswer(TelnyxCallState.HELD)).toBe(false);
        expect(CallStateHelpers.canAnswer(TelnyxCallState.ENDED)).toBe(false);
        expect(CallStateHelpers.canAnswer(TelnyxCallState.FAILED)).toBe(false);
      });
    });

    describe('canHangup', () => {
      it('should return true for active states', () => {
        expect(CallStateHelpers.canHangup(TelnyxCallState.RINGING)).toBe(true);
        expect(CallStateHelpers.canHangup(TelnyxCallState.ACTIVE)).toBe(true);
        expect(CallStateHelpers.canHangup(TelnyxCallState.HELD)).toBe(true);
        expect(CallStateHelpers.canHangup(TelnyxCallState.ENDED)).toBe(false);
        expect(CallStateHelpers.canHangup(TelnyxCallState.FAILED)).toBe(false);
      });
    });

    describe('canHold', () => {
      it('should return true only for ACTIVE state', () => {
        expect(CallStateHelpers.canHold(TelnyxCallState.ACTIVE)).toBe(true);
        expect(CallStateHelpers.canHold(TelnyxCallState.RINGING)).toBe(false);
        expect(CallStateHelpers.canHold(TelnyxCallState.HELD)).toBe(false);
        expect(CallStateHelpers.canHold(TelnyxCallState.ENDED)).toBe(false);
        expect(CallStateHelpers.canHold(TelnyxCallState.FAILED)).toBe(false);
      });
    });

    describe('canResume', () => {
      it('should return true only for HELD state', () => {
        expect(CallStateHelpers.canResume(TelnyxCallState.HELD)).toBe(true);
        expect(CallStateHelpers.canResume(TelnyxCallState.RINGING)).toBe(false);
        expect(CallStateHelpers.canResume(TelnyxCallState.ACTIVE)).toBe(false);
        expect(CallStateHelpers.canResume(TelnyxCallState.ENDED)).toBe(false);
        expect(CallStateHelpers.canResume(TelnyxCallState.FAILED)).toBe(false);
      });
    });

    describe('canToggleMute', () => {
      it('should return true for ACTIVE and HELD states', () => {
        expect(CallStateHelpers.canToggleMute(TelnyxCallState.ACTIVE)).toBe(true);
        expect(CallStateHelpers.canToggleMute(TelnyxCallState.HELD)).toBe(true);
        expect(CallStateHelpers.canToggleMute(TelnyxCallState.RINGING)).toBe(false);
        expect(CallStateHelpers.canToggleMute(TelnyxCallState.ENDED)).toBe(false);
        expect(CallStateHelpers.canToggleMute(TelnyxCallState.FAILED)).toBe(false);
      });
    });

    describe('isTerminated', () => {
      it('should return true for terminal states', () => {
        expect(CallStateHelpers.isTerminated(TelnyxCallState.ENDED)).toBe(true);
        expect(CallStateHelpers.isTerminated(TelnyxCallState.FAILED)).toBe(true);
        expect(CallStateHelpers.isTerminated(TelnyxCallState.RINGING)).toBe(false);
        expect(CallStateHelpers.isTerminated(TelnyxCallState.ACTIVE)).toBe(false);
        expect(CallStateHelpers.isTerminated(TelnyxCallState.HELD)).toBe(false);
      });
    });

    describe('isActive', () => {
      it('should return true for active states', () => {
        expect(CallStateHelpers.isActive(TelnyxCallState.ACTIVE)).toBe(true);
        expect(CallStateHelpers.isActive(TelnyxCallState.HELD)).toBe(true);
        expect(CallStateHelpers.isActive(TelnyxCallState.RINGING)).toBe(false);
        expect(CallStateHelpers.isActive(TelnyxCallState.ENDED)).toBe(false);
        expect(CallStateHelpers.isActive(TelnyxCallState.FAILED)).toBe(false);
      });
    });
  });
});
