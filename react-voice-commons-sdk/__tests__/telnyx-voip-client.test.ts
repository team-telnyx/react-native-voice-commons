import {
  TelnyxVoipClient,
  createTelnyxVoipClient,
  destroyTelnyxVoipClient,
} from '../src/telnyx-voip-client';
import { callKitCoordinator } from '../src/callkit/callkit-coordinator';
import { TelnyxCallState } from '../src/models/call-state';

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('TelnyxVoipClient singleton lifecycle', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    await destroyTelnyxVoipClient();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await destroyTelnyxVoipClient();
  });

  it('detaches the shared instance before async disposal settles', async () => {
    let resolveDispose: (() => void) | undefined;
    const disposeSpy = jest.spyOn(TelnyxVoipClient.prototype, 'dispose').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDispose = resolve;
        })
    );

    const firstClient = createTelnyxVoipClient();
    const destroyPromise = destroyTelnyxVoipClient();
    const secondClient = createTelnyxVoipClient();

    expect(secondClient).not.toBe(firstClient);
    expect(disposeSpy).toHaveBeenCalledTimes(1);
    expect(resolveDispose).toBeDefined();

    resolveDispose?.();
    await destroyPromise;
  });

  it('makes concurrent dispose callers wait for the same teardown', async () => {
    const client = new TelnyxVoipClient();
    let resolveSessionDispose: (() => void) | undefined;
    const sessionDispose = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSessionDispose = resolve;
        })
    );
    const callStateDispose = jest.fn();

    (client as any)._sessionManager.dispose = sessionDispose;
    (client as any)._callStateController.dispose = callStateDispose;

    const firstDispose = client.dispose();
    let secondSettled = false;
    const secondDispose = client.dispose().then(() => {
      secondSettled = true;
    });

    await flushMicrotasks();

    expect(sessionDispose).toHaveBeenCalledTimes(1);
    expect(callStateDispose).not.toHaveBeenCalled();
    expect(secondSettled).toBe(false);
    expect(resolveSessionDispose).toBeDefined();

    resolveSessionDispose?.();

    await Promise.all([firstDispose, secondDispose]);

    expect(secondSettled).toBe(true);
    expect(callStateDispose).toHaveBeenCalledTimes(1);
  });

  it('forwards active call selection to the call state controller', () => {
    const client = new TelnyxVoipClient();
    const setActiveCall = jest.fn();
    const clearActiveCall = jest.fn();

    (client as any)._callStateController.setActiveCall = setActiveCall;
    (client as any)._callStateController.clearActiveCall = clearActiveCall;

    client.setActiveCall('call-2');
    client.clearActiveCall();

    expect(setActiveCall).toHaveBeenCalledWith('call-2');
    expect(clearActiveCall).toHaveBeenCalledTimes(1);
  });

  it('coordinates an iOS swap using the current active call and requested held call', async () => {
    const client = new TelnyxVoipClient();
    const activeTelnyxCall = { callId: 'active-signal' };
    const heldTelnyxCall = { callId: 'held-signal' };
    const activeCall = {
      callId: 'active',
      currentState: TelnyxCallState.ACTIVE,
      telnyxCall: activeTelnyxCall,
    };
    const heldCall = {
      callId: 'held',
      currentState: TelnyxCallState.HELD,
      telnyxCall: heldTelnyxCall,
    };
    jest.spyOn(client, 'currentActiveCall', 'get').mockReturnValue(activeCall as any);
    jest.spyOn(client, 'getCall').mockReturnValue(heldCall as any);
    jest.spyOn(callKitCoordinator, 'isAvailable').mockReturnValue(true);
    const swap = jest.spyOn(callKitCoordinator, 'swapCallsFromUI').mockResolvedValue(true);

    await client.swapCalls('held');

    expect(swap).toHaveBeenCalledWith(activeTelnyxCall, heldTelnyxCall);
  });
});
