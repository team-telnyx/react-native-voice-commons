import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TelnyxSDK from '@telnyx/react-native-voice-sdk';
import { TelnyxVoipClient } from '../src/telnyx-voip-client';
import { createCredentialConfig, createTokenConfig } from '../src/models/config';
import { VoicePnBridge } from '../src/internal/voice-pn-bridge';
import { parseStoredIceServers } from '../src/internal/ice-servers-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const CUSTOM_ICE_SERVERS = [
  { urls: 'stun:stun.example.com:3478' },
  { urls: 'turn:turn.example.com:3478?transport=tcp', username: 'user', credential: 'secret' },
];

describe('parseStoredIceServers', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a valid stored list', () => {
    expect(parseStoredIceServers(JSON.stringify(CUSTOM_ICE_SERVERS))).toEqual(CUSTOM_ICE_SERVERS);
  });

  it.each([
    ['missing', null],
    ['malformed JSON', '{not json'],
    ['not an array', '{"urls":"stun:x"}'],
    ['an empty list', '[]'],
    ['an entry without urls', '[{"username":"u"}]'],
    ['a non-string credential', '[{"urls":"turn:x","credential":42}]'],
  ])('returns undefined for %s', (_label, stored) => {
    expect(parseStoredIceServers(stored)).toBeUndefined();
  });
});

describe.each([
  [
    'credential',
    () => createCredentialConfig('sip-user', 'sip-password'),
    'connectWithCredential',
    'login',
  ],
  ['token', () => createTokenConfig('stored-token'), 'connectWithToken', 'loginWithToken'],
])('custom ICE servers round trip for %s auth', (_kind, makeConfig, connectMethod, loginMethod) => {
  // In-memory AsyncStorage so a login's writes are what the restore reads.
  let store: Record<string, string>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(VoicePnBridge, 'getVoipToken').mockResolvedValue(null);
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    store = {};
    (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key: string, value: string) => {
      store[key] = value;
    });
    (AsyncStorage.removeItem as jest.Mock).mockImplementation(async (key: string) => {
      delete store[key];
    });
    (AsyncStorage.getItem as jest.Mock).mockImplementation(
      async (key: string) => store[key] ?? null
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const loginWith = async (iceServers?: typeof CUSTOM_ICE_SERVERS) => {
    const client = new TelnyxVoipClient();
    jest.spyOn((client as any)._sessionManager, connectMethod).mockResolvedValue(undefined);
    await (client as any)[loginMethod]({ ...makeConfig(), iceServers });
  };

  const foregroundRestoreIceServers = async () => {
    const client = new TelnyxVoipClient();
    const connect = jest
      .spyOn((client as any)._sessionManager, connectMethod)
      .mockResolvedValue(undefined);
    await expect(client.loginFromStoredConfig()).resolves.toBe(true);
    return (connect.mock.calls[0][0] as { iceServers?: unknown }).iceServers;
  };

  const coldPushRestoreIceServers = async () => {
    const client = new TelnyxVoipClient();
    await (client as any)._sessionManager.handlePushNotification({
      metadata: { call_id: 'call-id' },
    });
    const TelnyxRTCMock = TelnyxSDK.TelnyxRTC as unknown as jest.Mock;
    expect(TelnyxRTCMock).toHaveBeenCalled();
    return TelnyxRTCMock.mock.calls[TelnyxRTCMock.mock.calls.length - 1][0].iceServers;
  };

  it('restores custom ICE servers on foreground reconnect and cold-start push', async () => {
    await loginWith(CUSTOM_ICE_SERVERS);
    expect(JSON.parse(store['@ice_servers'])).toEqual(CUSTOM_ICE_SERVERS);

    expect(await foregroundRestoreIceServers()).toEqual(CUSTOM_ICE_SERVERS);
    expect(await coldPushRestoreIceServers()).toEqual(CUSTOM_ICE_SERVERS);
  });

  it('clears stored ICE servers when a later login omits them', async () => {
    await loginWith(CUSTOM_ICE_SERVERS);
    await loginWith(undefined);

    expect(store['@ice_servers']).toBeUndefined();
    expect(await foregroundRestoreIceServers()).toBeUndefined();
    expect(await coldPushRestoreIceServers()).toBeUndefined();
  });

  it('keeps the stored login when the stored ICE servers are corrupted', async () => {
    await loginWith(CUSTOM_ICE_SERVERS);
    store['@ice_servers'] = '{corrupted';

    expect(await foregroundRestoreIceServers()).toBeUndefined();
    expect(await coldPushRestoreIceServers()).toBeUndefined();
  });
});

describe('push-flow context scoping', () => {
  let store: Record<string, string>;
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
    jest.spyOn(VoicePnBridge, 'getVoipToken').mockResolvedValue(null);
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

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

    // Give every connection attempt an inspectable client, and keep it free of
    // active calls so pushes exercise the cold-start path.
    originalTelnyxRTCImplementation = telnyxRTCMock().getMockImplementation();
    telnyxRTCMock().mockImplementation(() => createFakeTelnyxClient());
  });

  afterEach(() => {
    telnyxRTCMock().mockImplementation(originalTelnyxRTCImplementation);
    jest.restoreAllMocks();
  });

  const processedPushPayloads = () =>
    telnyxRTCMock()
      .mock.results.map((result) => result.value as ReturnType<typeof createFakeTelnyxClient>)
      .flatMap((client) => client?.processVoIPNotification?.mock?.calls ?? [])
      .map((call) => call[0]);

  it('does not stamp a later ordinary login with an abandoned push voice_sdk_id', async () => {
    const client = new TelnyxVoipClient();
    const manager = (client as any)._sessionManager;

    // With no stored credentials the push connection cannot be established.
    // Its metadata must be dropped, not kept for the next connect.
    await manager.handlePushNotification({
      metadata: { call_id: 'abandoned-push', voice_sdk_id: 'abandoned-voice-sdk-id' },
      from_notification: true,
      action: 'answer',
    });

    expect(manager.telnyxClient).toBeUndefined();

    await manager.connectWithCredential(createCredentialConfig('sip-user', 'sip-password'));

    expect(processedPushPayloads()).toEqual([]);
  });

  it('extracts wrapped push metadata without mutating the caller payload', async () => {
    const client = new TelnyxVoipClient();
    const manager = (client as any)._sessionManager;
    const fakeClient = {
      getActiveCalls: () => [{ state: 'active' }],
      processVoIPNotification: jest.fn(),
    };
    (manager as any)._telnyxClient = fakeClient;

    const payload = {
      metadata: { call_id: 'push-call', voice_sdk_id: 'push-voice-sdk-id' },
      from_notification: true,
      action: 'answer',
    };

    await manager.handlePushNotification(payload);

    expect(payload.metadata).toEqual({
      call_id: 'push-call',
      voice_sdk_id: 'push-voice-sdk-id',
    });
    expect(fakeClient.processVoIPNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        call_id: 'push-call',
        voice_sdk_id: 'push-voice-sdk-id',
        from_notification: true,
        action: 'answer',
      })
    );
  });

  it('parses JSON-string push metadata for a push answer action', async () => {
    const client = new TelnyxVoipClient();
    const manager = (client as any)._sessionManager;
    const fakeClient = {
      getActiveCalls: () => [{ state: 'active' }],
      processVoIPNotification: jest.fn(),
    };
    (manager as any)._telnyxClient = fakeClient;

    await manager.handlePushNotification({
      metadata: JSON.stringify({ call_id: 'string-push', voice_sdk_id: 'string-voice-sdk-id' }),
      from_notification: true,
      action: 'answer',
    });

    expect(fakeClient.processVoIPNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        call_id: 'string-push',
        voice_sdk_id: 'string-voice-sdk-id',
        from_notification: true,
        action: 'answer',
      })
    );
  });

  it.each(['ringing', 'connecting', 'active', 'held'])(
    'keeps the client that owns a %s call for a sequential push',
    async (state) => {
      const client = new TelnyxVoipClient();
      const manager = (client as any)._sessionManager;
      const fakeClient = {
        disconnect: jest.fn(() => Promise.resolve()),
        getActiveCalls: jest.fn(() => [{ state }]),
        processVoIPNotification: jest.fn(),
      };
      (manager as any)._telnyxClient = fakeClient;

      await manager.handlePushNotification({
        metadata: { call_id: 'second-push', voice_sdk_id: 'second-voice-sdk-id' },
        from_notification: true,
        action: 'answer',
      });

      // Handling the second push must not tear down the first flow's socket
      // or clear the state CallKit still needs to finish it.
      expect(fakeClient.disconnect).not.toHaveBeenCalled();
      expect(fakeClient.processVoIPNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          call_id: 'second-push',
          voice_sdk_id: 'second-voice-sdk-id',
          from_notification: true,
          action: 'answer',
        })
      );
    }
  );

  it('passes each push payload to its own connection attempt', async () => {
    const client = new TelnyxVoipClient();
    const manager = (client as any)._sessionManager;
    (manager as any)._currentConfig = createCredentialConfig('sip-user', 'sip-password');
    const connectSpy = jest.spyOn(manager, '_connect').mockResolvedValue(undefined);

    const firstPush = {
      metadata: { call_id: 'first-push', voice_sdk_id: 'first-voice-sdk-id' },
      from_notification: true,
      action: 'answer',
    };
    const secondPush = {
      metadata: { call_id: 'second-push', voice_sdk_id: 'second-voice-sdk-id' },
      from_notification: true,
      action: 'answer',
    };

    await manager.handlePushNotification(firstPush);
    await manager.handlePushNotification(secondPush);

    expect(connectSpy).toHaveBeenNthCalledWith(1, firstPush);
    expect(connectSpy).toHaveBeenNthCalledWith(2, secondPush);
  });

  it.each([
    ['credential', 'login', () => createCredentialConfig('sip-user', 'sip-password')],
    ['token', 'loginWithToken', () => createTokenConfig('login-token')],
  ])(
    'clears a persisted push context before an ordinary %s login',
    async (_label, loginMethod, makeConfig) => {
      store['@telnyx_push_state'] = JSON.stringify({
        isCallFromPush: true,
        pushNotificationPayload: { metadata: { call_id: 'stale-push' } },
        pushNotificationCallKitUUID: 'stale-push',
        voice_sdk_id: 'stale-push-voice-sdk-id',
        timestamp: Date.now(),
      });

      const client = new TelnyxVoipClient();
      jest
        .spyOn((client as any)._sessionManager, 'connectWithCredential')
        .mockResolvedValue(undefined);
      jest.spyOn((client as any)._sessionManager, 'connectWithToken').mockResolvedValue(undefined);

      await (client as any)[loginMethod](makeConfig());

      expect(store['@telnyx_push_state']).toBeUndefined();
    }
  );
});
