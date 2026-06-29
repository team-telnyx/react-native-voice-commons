import {
  TelnyxVoipClient,
  createTelnyxVoipClient,
  destroyTelnyxVoipClient,
} from '../src/telnyx-voip-client';

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
});
