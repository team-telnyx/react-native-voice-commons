import AsyncStorage from '@react-native-async-storage/async-storage';
import { TelnyxVoipClient } from '../src/telnyx-voip-client';
import { createCredentialConfig, createTokenConfig } from '../src/models/config';
import { VoicePnBridge } from '../src/internal/voice-pn-bridge';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('push-when-active configuration persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(VoicePnBridge, 'getVoipToken').mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stores the opt-in for cold-start push login', async () => {
    const client = new TelnyxVoipClient();
    jest
      .spyOn((client as any)._sessionManager, 'connectWithCredential')
      .mockResolvedValue(undefined);

    await client.login(
      createCredentialConfig('sip-user', 'sip-password', {
        pushNotificationDeviceToken: 'push-token',
        pushWhenActive: true,
      })
    );

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@push_when_active', 'true');
  });

  it('restores the opt-in when reconnecting from stored credentials', async () => {
    const storedValues: Record<string, string> = {
      '@telnyx_username': 'sip-user',
      '@telnyx_password': 'sip-password',
      '@push_token': 'push-token',
      '@push_when_active': 'true',
    };
    (AsyncStorage.getItem as jest.Mock).mockImplementation(
      async (key: string) => storedValues[key] ?? null
    );
    const client = new TelnyxVoipClient();
    const connect = jest
      .spyOn((client as any)._sessionManager, 'connectWithCredential')
      .mockResolvedValue(undefined);

    await expect(client.loginFromStoredConfig()).resolves.toBe(true);
    expect(connect).toHaveBeenCalledWith(
      expect.objectContaining({
        pushNotificationDeviceToken: 'push-token',
        pushWhenActive: true,
      })
    );
  });

  it('hydrates a missing credential-login token from native PushKit storage', async () => {
    jest.spyOn(VoicePnBridge, 'getVoipToken').mockResolvedValue('native-push-token');
    const client = new TelnyxVoipClient();
    const connect = jest
      .spyOn((client as any)._sessionManager, 'connectWithCredential')
      .mockResolvedValue(undefined);

    await client.login(
      createCredentialConfig('sip-user', 'sip-password', {
        pushWhenActive: true,
      })
    );

    expect(connect).toHaveBeenCalledWith(
      expect.objectContaining({
        pushNotificationDeviceToken: 'native-push-token',
        pushWhenActive: true,
      })
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@push_token', 'native-push-token');
  });

  it('hydrates a missing token-login token from native PushKit storage', async () => {
    jest.spyOn(VoicePnBridge, 'getVoipToken').mockResolvedValue('native-push-token');
    const client = new TelnyxVoipClient();
    const connect = jest
      .spyOn((client as any)._sessionManager, 'connectWithToken')
      .mockResolvedValue(undefined);

    await client.loginWithToken(
      createTokenConfig('credential-token', {
        pushWhenActive: true,
      })
    );

    expect(connect).toHaveBeenCalledWith(
      expect.objectContaining({
        pushNotificationDeviceToken: 'native-push-token',
        pushWhenActive: true,
      })
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@push_token', 'native-push-token');
  });

  it('refreshes a stale stored push token before reconnecting', async () => {
    const storedValues: Record<string, string> = {
      '@telnyx_username': 'sip-user',
      '@telnyx_password': 'sip-password',
      '@push_token': 'stale-push-token',
      '@push_when_active': 'true',
    };
    (AsyncStorage.getItem as jest.Mock).mockImplementation(
      async (key: string) => storedValues[key] ?? null
    );
    jest.spyOn(VoicePnBridge, 'getVoipToken').mockResolvedValue('current-native-token');
    const client = new TelnyxVoipClient();
    const connect = jest
      .spyOn((client as any)._sessionManager, 'connectWithCredential')
      .mockResolvedValue(undefined);

    await expect(client.loginFromStoredConfig()).resolves.toBe(true);

    expect(connect).toHaveBeenCalledWith(
      expect.objectContaining({
        pushNotificationDeviceToken: 'current-native-token',
      })
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@push_token', 'current-native-token');
  });
});
