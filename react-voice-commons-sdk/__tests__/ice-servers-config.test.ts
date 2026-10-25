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
