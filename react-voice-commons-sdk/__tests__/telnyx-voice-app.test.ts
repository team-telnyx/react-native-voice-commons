const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const loadTelnyxVoiceApp = (backgroundClient: {
  handlePushNotification: jest.Mock;
  dispose: jest.Mock;
}) => {
  const createBackgroundTelnyxVoipClient = jest.fn(() => backgroundClient);

  jest.doMock('../src/telnyx-voip-client', () => ({
    TelnyxVoipClient: jest.fn(),
    createBackgroundTelnyxVoipClient,
  }));

  const { TelnyxVoiceApp } = require('../src/telnyx-voice-app');

  return {
    TelnyxVoiceApp,
    createBackgroundTelnyxVoipClient,
  };
};

describe('TelnyxVoiceApp background push disposal', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.dontMock('../src/telnyx-voip-client');
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it('awaits background client disposal before resolving', async () => {
    const events: string[] = [];
    let resolveDispose: (() => void) | undefined;
    const message = { metadata: { call_id: 'background-call-id' } };
    const backgroundClient = {
      handlePushNotification: jest.fn().mockImplementation(async () => {
        events.push('handle-push');
      }),
      dispose: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            events.push('dispose-start');
            resolveDispose = () => {
              events.push('dispose-end');
              resolve();
            };
          })
      ),
    };
    const { TelnyxVoiceApp, createBackgroundTelnyxVoipClient } =
      loadTelnyxVoiceApp(backgroundClient);
    let settled = false;

    const pushPromise = TelnyxVoiceApp.handleBackgroundPush(message).then(() => {
      settled = true;
    });

    await flushMicrotasks();

    expect(createBackgroundTelnyxVoipClient).toHaveBeenCalledWith({ debug: false });
    expect(backgroundClient.handlePushNotification).toHaveBeenCalledWith(message);
    expect(backgroundClient.dispose).toHaveBeenCalledTimes(1);
    expect(events).toEqual(['handle-push', 'dispose-start']);
    expect(settled).toBe(false);

    if (!resolveDispose) {
      throw new Error('dispose promise was not created');
    }

    resolveDispose();
    await pushPromise;

    expect(settled).toBe(true);
    expect(events).toEqual(['handle-push', 'dispose-start', 'dispose-end']);
  });

  it('disposes the background client when push handling fails', async () => {
    const message = { metadata: { call_id: 'background-call-id' } };
    const backgroundClient = {
      handlePushNotification: jest.fn().mockRejectedValue(new Error('push failed')),
      dispose: jest.fn().mockResolvedValue(undefined),
    };
    const { TelnyxVoiceApp } = loadTelnyxVoiceApp(backgroundClient);

    await TelnyxVoiceApp.handleBackgroundPush(message);

    expect(backgroundClient.handlePushNotification).toHaveBeenCalledWith(message);
    expect(backgroundClient.dispose).toHaveBeenCalledTimes(1);
  });
});
