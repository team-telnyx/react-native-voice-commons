import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

describe('LoginHandler session ID ordering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  it.each([
    ['fresh', {}, { reconnection: false }],
    [
      'push',
      { fromPush: true },
      { reconnection: false, from_push: true, loginParams: { attach_call: 'true' } },
    ],
    [
      'recovery',
      { sessionId: 'confirmed-session' },
      { reconnection: true, sessid: 'confirmed-session', loginParams: { attach_call: 'true' } },
    ],
  ])('serializes %s intent for both authentication modes', async (_mode, intent, expected) => {
    const { LoginHandler } = jest.requireActual('../lib/login-handler.ts');
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('legacy-global-session');
    for (const auth of [
      { login: 'user', password: 'test-password' },
      { login_token: 'test-token' },
    ]) {
      const sendAndWait = jest.fn().mockResolvedValue(null);
      const handler = new LoginHandler(
        { addListener: jest.fn(), sendAndWait },
        {
          name: 'test-sdk',
          version: '1',
        }
      );
      // Legacy values injected via options must never determine recovery identity either.
      await handler.login({ ...auth, sessid: 'unconfirmed-session' }, undefined, intent);
      const params = sendAndWait.mock.calls[0][0].params;
      const { reconnection, from_push, loginParams, sessid } = params;
      expect({ reconnection, from_push, loginParams, sessid }).toEqual(expected);
      for (const key of ['from_push', 'loginParams', 'sessid']) {
        if (!(key in expected)) expect(params).not.toHaveProperty(key);
      }
    }
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  });

  it.each([
    ['registered-route', 'registered-route'],
    [undefined, 'voice-sdk-id'],
  ])(
    'publishes the early login ID and returns the REGED identity (route %s)',
    async (route, expectedRoute) => {
      const { LoginHandler } = jest.requireActual('../lib/login-handler.ts');
      let onMessage: (message: unknown) => void = () => {};
      const connection = {
        addListener: jest.fn((event: string, listener: (message: unknown) => void) => {
          if (event === 'telnyx.socket.message') onMessage = listener;
        }),
        sendAndWait: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'login',
            result: { message: 'logged in', sessid: 'new-session-id' },
            voice_sdk_id: 'voice-sdk-id',
          })
          .mockResolvedValueOnce({
            id: 'gateway-state',
            jsonrpc: '2.0',
            result: { params: { state: 'REGED' }, sessid: 'registered-session-id' },
            voice_sdk_id: route,
          }),
      };
      const handler = new LoginHandler(connection as any, {
        name: 'webrtc-react-native',
        version: '1.2.0',
      });
      const onSessionId = jest.fn();
      let loginFinished = false;

      const login = handler
        .login({ login_token: 'token' }, onSessionId)
        .then((session: { id: string; voiceSDKId?: string } | null) => {
          loginFinished = true;
          return session;
        });

      for (let index = 0; index < 5; index += 1) {
        await Promise.resolve();
      }

      expect(onSessionId).toHaveBeenCalledWith('new-session-id', 'voice-sdk-id');
      expect(AsyncStorage.getItem).not.toHaveBeenCalled();
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
      expect(loginFinished).toBe(false);

      onMessage({ method: 'telnyx_rtc.clientReady' });
      await expect(login).resolves.toEqual({
        id: 'registered-session-id',
        voiceSDKId: expectedRoute,
      });
    }
  );
});
