import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TelnyxSDK from '@telnyx/react-native-voice-sdk';
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

  it('stores and restores the signaling environment', async () => {
    const client = new TelnyxVoipClient();
    const connect = jest
      .spyOn((client as any)._sessionManager, 'connectWithCredential')
      .mockResolvedValue(undefined);

    await client.login(
      createCredentialConfig('sip-user', 'sip-password', {
        environment: 'development',
      })
    );

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@telnyx_signaling_environment',
      'development'
    );

    const storedValues: Record<string, string> = {
      '@telnyx_username': 'sip-user',
      '@telnyx_password': 'sip-password',
      '@telnyx_signaling_environment': 'development',
    };
    (AsyncStorage.getItem as jest.Mock).mockImplementation(
      async (key: string) => storedValues[key] ?? null
    );
    connect.mockClear();

    await expect(client.loginFromStoredConfig()).resolves.toBe(true);
    expect(connect).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: 'development',
      })
    );
  });

  describe.each([
    [
      'credential',
      () => createCredentialConfig('sip-user', 'sip-password'),
      'connectWithCredential',
      'login',
    ],
    ['token', () => createTokenConfig('stored-token'), 'connectWithToken', 'loginWithToken'],
  ])(
    'quality metrics opt-in round trip for %s auth',
    (_kind, makeConfig, connectMethod, loginMethod) => {
      // In-memory AsyncStorage so a login's writes are what the restore reads.
      let store: Record<string, string>;
      beforeEach(() => {
        store = {};
        (AsyncStorage.setItem as jest.Mock).mockImplementation(
          async (key: string, value: string) => {
            store[key] = value;
          }
        );
        (AsyncStorage.removeItem as jest.Mock).mockImplementation(async (key: string) => {
          delete store[key];
        });
        (AsyncStorage.getItem as jest.Mock).mockImplementation(
          async (key: string) => store[key] ?? null
        );
      });

      const loginWith = async (enableQualityMetrics: boolean) => {
        const client = new TelnyxVoipClient();
        const connect = jest
          .spyOn((client as any)._sessionManager, connectMethod)
          .mockResolvedValue(undefined);
        await (client as any)[loginMethod]({ ...makeConfig(), enableQualityMetrics });
        expect(connect).toHaveBeenCalledWith(expect.objectContaining({ enableQualityMetrics }));
      };

      it.each([true, false])(
        'restores enableQualityMetrics=%p in the foreground and on a cold push',
        async (enableQualityMetrics) => {
          await loginWith(enableQualityMetrics);
          expect(store['@enable_quality_metrics']).toBe(String(enableQualityMetrics));

          // Foreground restore (process restart with automatic login).
          const restored = new TelnyxVoipClient();
          const connect = jest
            .spyOn((restored as any)._sessionManager, connectMethod)
            .mockResolvedValue(undefined);
          await expect(restored.loginFromStoredConfig()).resolves.toBe(true);
          expect(connect).toHaveBeenCalledWith(expect.objectContaining({ enableQualityMetrics }));

          // Cold-start push restore builds the core client from storage.
          const pushed = new TelnyxVoipClient();
          await (pushed as any)._sessionManager.handlePushNotification({
            metadata: { call_id: 'call-id' },
          });
          const TelnyxRTCMock = TelnyxSDK.TelnyxRTC as unknown as jest.Mock;
          const clientOptions = TelnyxRTCMock.mock.calls[TelnyxRTCMock.mock.calls.length - 1][0];
          expect(clientOptions.enableQualityMetrics).toBe(enableQualityMetrics);
        }
      );

      it('turns the opt-in off again after a later login disables it', async () => {
        await loginWith(true);
        await loginWith(false);

        expect(store['@enable_quality_metrics']).toBe('false');
        const restored = new TelnyxVoipClient();
        const connect = jest
          .spyOn((restored as any)._sessionManager, connectMethod)
          .mockResolvedValue(undefined);
        await restored.loginFromStoredConfig();
        expect(connect).toHaveBeenCalledWith(
          expect.objectContaining({ enableQualityMetrics: false })
        );
      });
    }
  );

  describe.each([
    [
      'credential',
      { '@telnyx_username': 'sip-user', '@telnyx_password': 'sip-password' },
      'connectWithCredential',
    ],
    ['token', { '@credential_token': 'stored-token' }, 'connectWithToken'],
  ])('signaling environment restore for %s auth', (_kind, storedAuth, connectMethod) => {
    const mockStorage = (storedEnvironment: string | null) => {
      const storedValues: Record<string, string> = { ...storedAuth };
      if (storedEnvironment !== null) {
        storedValues['@telnyx_signaling_environment'] = storedEnvironment;
      }
      (AsyncStorage.getItem as jest.Mock).mockImplementation(
        async (key: string) => storedValues[key] ?? null
      );
    };

    const foregroundRestoreEnvironment = async (client: TelnyxVoipClient) => {
      const connect = jest
        .spyOn((client as any)._sessionManager, connectMethod)
        .mockResolvedValue(undefined);
      await expect(client.loginFromStoredConfig()).resolves.toBe(true);
      return (connect.mock.calls[0][0] as { environment?: string }).environment;
    };

    const coldPushRestoreEnvironment = async (client: TelnyxVoipClient) => {
      await (client as any)._sessionManager.handlePushNotification({
        metadata: { call_id: 'call-id' },
      });
      const TelnyxRTCMock = TelnyxSDK.TelnyxRTC as unknown as jest.Mock;
      return TelnyxRTCMock.mock.calls[TelnyxRTCMock.mock.calls.length - 1][0].environment;
    };

    it.each([
      ['missing', null],
      ['invalid', 'staging'],
    ])(
      'honors the client default when the stored value is %s',
      async (_case, storedEnvironment) => {
        mockStorage(storedEnvironment);

        expect(
          await foregroundRestoreEnvironment(new TelnyxVoipClient({ environment: 'development' }))
        ).toBe('development');
        expect(
          await coldPushRestoreEnvironment(new TelnyxVoipClient({ environment: 'development' }))
        ).toBe('development');
      }
    );

    it.each([
      ['production', 'development'],
      ['development', 'production'],
    ] as const)(
      'prefers an explicit stored %s selection over the client default',
      async (storedEnvironment, clientDefault) => {
        mockStorage(storedEnvironment);

        expect(
          await foregroundRestoreEnvironment(new TelnyxVoipClient({ environment: clientDefault }))
        ).toBe(storedEnvironment);
        expect(
          await coldPushRestoreEnvironment(new TelnyxVoipClient({ environment: clientDefault }))
        ).toBe(storedEnvironment);
      }
    );

    it('defaults to production when neither storage nor the client specifies one', async () => {
      mockStorage(null);

      expect(await foregroundRestoreEnvironment(new TelnyxVoipClient())).toBe('production');
      expect(await coldPushRestoreEnvironment(new TelnyxVoipClient())).toBe('production');
    });
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
