import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TelnyxSDK from '@telnyx/react-native-voice-sdk';
import { TelnyxVoipClient } from '../src/telnyx-voip-client';
import { VoicePnBridge } from '../src/internal/voice-pn-bridge';
import { createCredentialConfig, createTokenConfig } from '../src/models/config';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

/**
 * The per-call push store is Android-only. These tests run the JS layers that
 * own fresh-login reset and end-of-push cleanup, so the platform has to be
 * Android for the bridge wrappers to reach the native mocks.
 */
const useAndroidPlatform = (): void => {
  require('react-native').Platform.OS = 'android';
};

type PushBridgeMock = {
  resetPushStateForFreshLogin: jest.Mock;
  completePushFlow: jest.Mock;
  clearAllPendingPushActions: jest.Mock;
  clearPendingPushActionForCall: jest.Mock;
};

const installPushBridgeMocks = (): PushBridgeMock => {
  const mocks: PushBridgeMock = {
    resetPushStateForFreshLogin: jest.fn().mockResolvedValue(true),
    completePushFlow: jest.fn().mockResolvedValue(true),
    clearAllPendingPushActions: jest.fn().mockResolvedValue(true),
    clearPendingPushActionForCall: jest.fn().mockResolvedValue(true),
  };

  // Assign instead of `spyOn` so this file still loads against a revision that
  // predates the per-call push store; the assertions then fail in-test.
  Object.assign(VoicePnBridge as any, mocks);
  return mocks;
};

const removePushBridgeMocks = (): void => {
  for (const key of [
    'resetPushStateForFreshLogin',
    'completePushFlow',
    'clearAllPendingPushActions',
    'clearPendingPushActionForCall',
  ]) {
    delete (VoicePnBridge as any)[key];
  }
};

describe('TelnyxVoipClient push flow lifecycle', () => {
  let store: Record<string, string>;
  let bridge: PushBridgeMock;
  let originalTelnyxRTCImplementation: ((options: unknown) => unknown) | undefined;

  const createFakeTelnyxClient = () => ({
    connect: jest.fn(() => Promise.resolve()),
    disconnect: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    off: jest.fn(),
    listenerCount: jest.fn(() => 0),
    processVoIPNotification: jest.fn(),
    getActiveCalls: jest.fn(() => [] as Array<{ state: string }>),
  });

  const telnyxRTCMock = () => TelnyxSDK.TelnyxRTC as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(VoicePnBridge, 'getVoipToken').mockResolvedValue(null);
    jest.spyOn(VoicePnBridge, 'setIncomingCallRingtone').mockResolvedValue(true);
    useAndroidPlatform();
    bridge = installPushBridgeMocks();

    store = {};
    (AsyncStorage.getItem as jest.Mock).mockImplementation(
      async (key: string) => store[key] ?? null
    );
    (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key: string, value: string) => {
      store[key] = value;
    });
    (AsyncStorage.removeItem as jest.Mock).mockImplementation(async (key: string) => {
      delete store[key];
    });

    originalTelnyxRTCImplementation = telnyxRTCMock().getMockImplementation();
    telnyxRTCMock().mockImplementation(() => createFakeTelnyxClient());
  });

  afterEach(() => {
    telnyxRTCMock().mockImplementation(originalTelnyxRTCImplementation);
    removePushBridgeMocks();
    require('react-native').Platform.OS = 'ios';
    jest.restoreAllMocks();
  });

  describe('fresh login versus reconnect', () => {
    it('resets the native push store before a credential login', async () => {
      const client = new TelnyxVoipClient();

      await client.login(createCredentialConfig('sip-user', 'sip-password'));

      expect(bridge.resetPushStateForFreshLogin).toHaveBeenCalledTimes(1);
      // The old persisted push context must go too, not just the native store.
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@telnyx_push_state');
    });

    it('resets the native push store before a token login', async () => {
      const client = new TelnyxVoipClient();

      await client.loginWithToken(createTokenConfig('login-token'));

      expect(bridge.resetPushStateForFreshLogin).toHaveBeenCalledTimes(1);
    });

    it('keeps the push identity when reconnecting from a stored session', async () => {
      const client = new TelnyxVoipClient();
      store['@telnyx_username'] = 'stored-user';
      store['@telnyx_password'] = 'stored-password';

      await expect(client.loginFromStoredConfig()).resolves.toBe(true);

      // A genuine reconnect reuses the session and its push routing id, so the
      // store must not be wiped.
      expect(bridge.resetPushStateForFreshLogin).not.toHaveBeenCalled();
      expect(bridge.clearAllPendingPushActions).not.toHaveBeenCalled();
    });
  });

  describe('push handling completion', () => {
    const clientWithPush = () => {
      const client = new TelnyxVoipClient();
      const manager = (client as any)._sessionManager;
      manager.handlePushNotification = jest.fn().mockResolvedValue(undefined);
      return { client, manager };
    };

    it('completes only the rejected call flow', async () => {
      const { client } = clientWithPush();

      await client.handlePushNotification({
        action: 'reject',
        metadata: { call_id: 'call-a', voice_sdk_id: 'voice-a' },
        from_notification: true,
      });

      expect(bridge.completePushFlow).toHaveBeenCalledTimes(1);
      expect(bridge.completePushFlow).toHaveBeenCalledWith('call-a', 'reject');
      expect(bridge.clearAllPendingPushActions).not.toHaveBeenCalled();
    });

    it('keeps an answered push flow so the pending INVITE can attach', async () => {
      const { client } = clientWithPush();

      await client.handlePushNotification({
        action: 'answer',
        metadata: { call_id: 'call-a', voice_sdk_id: 'voice-a' },
        from_notification: true,
      });

      expect(bridge.completePushFlow).not.toHaveBeenCalled();
      expect(bridge.clearAllPendingPushActions).not.toHaveBeenCalled();
    });

    it('completes the failing call flow when handling throws', async () => {
      const client = new TelnyxVoipClient();
      const manager = (client as any)._sessionManager;
      manager.handlePushNotification = jest.fn().mockRejectedValue(new Error('connect failed'));

      await expect(
        client.handlePushNotification({
          action: 'answer',
          metadata: { call_id: 'call-failing', voice_sdk_id: 'voice-failing' },
          from_notification: true,
        })
      ).rejects.toThrow('connect failed');

      expect(bridge.completePushFlow).toHaveBeenCalledWith('call-failing', 'failure');
      expect(bridge.clearAllPendingPushActions).not.toHaveBeenCalled();
    });

    it('does not clear the first call flow when a second push arrives', async () => {
      const { client } = clientWithPush();

      await client.handlePushNotification({
        action: 'answer',
        metadata: { call_id: 'call-second', voice_sdk_id: 'voice-second' },
        from_notification: true,
      });

      // A second (non-terminal) push must leave both flows intact.
      expect(bridge.completePushFlow).not.toHaveBeenCalled();
      expect(bridge.clearPendingPushActionForCall).not.toHaveBeenCalled();
      expect(bridge.clearAllPendingPushActions).not.toHaveBeenCalled();
    });
  });
});
