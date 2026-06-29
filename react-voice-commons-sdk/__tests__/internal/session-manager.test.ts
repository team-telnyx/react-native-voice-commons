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
});
