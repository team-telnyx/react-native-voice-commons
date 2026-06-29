import * as TelnyxSDK from '@telnyx/react-native-voice-sdk';
import { SessionManager } from '../../src/internal/session/session-manager';
import { createCredentialConfig } from '../../src/models/config';

describe('SessionManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('disconnects the underlying TelnyxRTC client before marking itself disposed', async () => {
    const manager = new SessionManager();

    await manager.connectWithCredential(createCredentialConfig('sip-user', 'sip-password'));

    const TelnyxRTCMock = TelnyxSDK.TelnyxRTC as unknown as jest.Mock;
    const telnyxClient = TelnyxRTCMock.mock.results[0]?.value;
    let disposedDuringDisconnect: boolean | undefined;

    expect(telnyxClient).toBeDefined();

    telnyxClient.disconnect.mockImplementation(() => {
      disposedDuringDisconnect = (manager as any)._disposed;
      return Promise.resolve();
    });

    const disposePromise = manager.dispose();

    expect(typeof disposePromise.then).toBe('function');

    await disposePromise;

    expect(telnyxClient.disconnect).toHaveBeenCalledTimes(1);
    expect(disposedDuringDisconnect).toBe(false);
  });

  it('disconnects and forgets a TelnyxRTC client whose connect resolves after dispose starts', async () => {
    const TelnyxRTCMock = TelnyxSDK.TelnyxRTC as unknown as jest.Mock;
    let resolveConnect: () => void = () => {};
    const telnyxClient = {
      connect: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveConnect = resolve;
          })
      ),
      disconnect: jest.fn(() => Promise.resolve()),
      newCall: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    };

    TelnyxRTCMock.mockImplementationOnce(() => telnyxClient);

    const manager = new SessionManager();
    const connectResult = manager
      .connectWithCredential(createCredentialConfig('sip-user', 'sip-password'))
      .then(
        () => undefined,
        (error: Error) => error
      );

    expect(telnyxClient.connect).toHaveBeenCalledTimes(1);
    expect(manager.telnyxClient).toBe(telnyxClient);

    let disposeCompleted = false;
    const disposePromise = manager.dispose().then(() => {
      disposeCompleted = true;
    });

    await Promise.resolve();

    expect(telnyxClient.disconnect).toHaveBeenCalledTimes(1);
    expect(disposeCompleted).toBe(false);

    resolveConnect();
    await disposePromise;

    const connectError = await connectResult;
    expect(connectError).toBeInstanceOf(Error);
    expect(connectError?.message).toBe('SessionManager has been disposed');
    expect(telnyxClient.disconnect).toHaveBeenCalledTimes(2);
    expect(manager.telnyxClient).toBeUndefined();

    await expect(
      manager.connectWithCredential(createCredentialConfig('other-user', 'other-password'))
    ).rejects.toThrow('SessionManager has been disposed');
  });

  it('cancels and forgets an in-flight connect when disconnect runs', async () => {
    const TelnyxRTCMock = TelnyxSDK.TelnyxRTC as unknown as jest.Mock;
    let resolveConnect: () => void = () => {};
    const telnyxClient = {
      connect: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveConnect = resolve;
          })
      ),
      disconnect: jest.fn(() => Promise.resolve()),
      newCall: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    };

    TelnyxRTCMock.mockImplementationOnce(() => telnyxClient);

    const manager = new SessionManager();
    const connectResult = manager
      .connectWithCredential(createCredentialConfig('sip-user', 'sip-password'))
      .then(
        () => undefined,
        (error: Error) => error
      );

    expect(telnyxClient.connect).toHaveBeenCalledTimes(1);
    expect(manager.telnyxClient).toBe(telnyxClient);

    await manager.disconnect();

    expect(telnyxClient.disconnect).toHaveBeenCalledTimes(1);
    expect(manager.telnyxClient).toBeUndefined();

    resolveConnect();

    const connectError = await connectResult;
    expect(connectError).toBeInstanceOf(Error);
    expect(connectError?.message).toBe('SessionManager connection has been canceled');
    expect(telnyxClient.disconnect).toHaveBeenCalledTimes(2);

    await expect(
      manager.connectWithCredential(createCredentialConfig('other-user', 'other-password'))
    ).resolves.toBeUndefined();
  });
});
