import { Call } from '../../src/models/call';
import { callKitCoordinator } from '../../src/callkit/callkit-coordinator';

describe('Commons Call answer through CallKit', () => {
  const makeRingingCall = () => {
    let stateListener: ((call: any, state: string) => void) | undefined;
    const telnyxCall = {
      callId: 'signaling-call-id',
      state: 'ringing',
      direction: 'inbound',
      inviteCustomHeaders: null,
      answerCustomHeaders: null,
      answer: jest.fn(),
      on: jest.fn((event: string, listener: (call: any, state: string) => void) => {
        if (event === 'telnyx.call.state') stateListener = listener;
      }),
    };
    const call = new Call(telnyxCall as any, 'call-id', '+15551234567', true);
    stateListener?.(telnyxCall, 'ringing');
    return { call, telnyxCall };
  };

  beforeEach(() => {
    jest.spyOn(callKitCoordinator, 'isAvailable').mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves when CallKit answers the call on iOS', async () => {
    const { call, telnyxCall } = makeRingingCall();
    const answerFromUI = jest.spyOn(callKitCoordinator, 'answerCallFromUI').mockResolvedValue(true);

    await expect(call.answer()).resolves.toBeUndefined();

    expect(answerFromUI).toHaveBeenCalledWith(telnyxCall);
    expect(telnyxCall.answer).not.toHaveBeenCalled();
    call.dispose();
  });

  it('rejects when CallKit reports that the answer failed on iOS', async () => {
    const { call, telnyxCall } = makeRingingCall();
    jest.spyOn(callKitCoordinator, 'answerCallFromUI').mockResolvedValue(false);

    // Callers such as Hold & Accept rely on this rejection to restore the held call.
    await expect(call.answer()).rejects.toThrow('CallKit failed to answer call');

    expect(telnyxCall.answer).not.toHaveBeenCalled();
    call.dispose();
  });
});
