import { Call } from '../../src/models/call';
import { callKitCoordinator } from '../../src/callkit/callkit-coordinator';

describe('Commons Call held state', () => {
  it('emits true for HELD and false after returning to ACTIVE', () => {
    let stateListener: ((call: any, state: string) => void) | undefined;
    const telnyxCall = {
      callId: 'signaling-call-id',
      state: 'active',
      direction: 'inbound',
      inviteCustomHeaders: null,
      answerCustomHeaders: null,
      on: jest.fn((event: string, listener: (call: any, state: string) => void) => {
        if (event === 'telnyx.call.state') stateListener = listener;
      }),
    };
    const call = new Call(telnyxCall as any, 'call-id', '+15551234567', true);
    const heldValues: boolean[] = [];
    call.isHeld$.subscribe((held) => heldValues.push(held));

    stateListener?.(telnyxCall, 'held');
    stateListener?.(telnyxCall, 'active');

    expect(heldValues).toEqual([false, true, false]);
    expect(call.currentIsHeld).toBe(false);
    call.dispose();
  });

  it('routes app hold and resume actions through CallKit on iOS', async () => {
    let stateListener: ((call: any, state: string) => void) | undefined;
    const telnyxCall = {
      callId: 'signaling-call-id',
      state: 'active',
      direction: 'inbound',
      inviteCustomHeaders: null,
      answerCustomHeaders: null,
      hold: jest.fn(),
      unhold: jest.fn(),
      on: jest.fn((event: string, listener: (call: any, state: string) => void) => {
        if (event === 'telnyx.call.state') stateListener = listener;
      }),
    };
    const call = new Call(telnyxCall as any, 'call-id', '+15551234567', true);
    jest.spyOn(callKitCoordinator, 'isAvailable').mockReturnValue(true);
    const setHeld = jest.spyOn(callKitCoordinator, 'setHeldFromUI').mockResolvedValue(true);

    stateListener?.(telnyxCall, 'active');
    await call.hold();
    stateListener?.(telnyxCall, 'held');
    await call.resume();

    expect(setHeld).toHaveBeenNthCalledWith(1, telnyxCall, true);
    expect(setHeld).toHaveBeenNthCalledWith(2, telnyxCall, false);
    expect(telnyxCall.hold).not.toHaveBeenCalled();
    expect(telnyxCall.unhold).not.toHaveBeenCalled();
    call.dispose();
  });

  it('forwards a manual ICE failure to the underlying SDK call', () => {
    const telnyxCall = {
      callId: 'signaling-call-id',
      state: 'active',
      direction: 'inbound',
      inviteCustomHeaders: null,
      answerCustomHeaders: null,
      simulateIceFailureForTesting: jest.fn().mockReturnValue(true),
      on: jest.fn(),
    };
    const call = new Call(telnyxCall as any, 'call-id', '+15551234567', true);

    expect(call.simulateIceFailureForTesting()).toBe(true);
    expect(telnyxCall.simulateIceFailureForTesting).toHaveBeenCalledTimes(1);
    call.dispose();
  });
});
