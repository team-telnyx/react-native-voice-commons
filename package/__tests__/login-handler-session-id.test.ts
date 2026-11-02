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

  it('publishes the login response session ID before waiting for client readiness', async () => {
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
          result: { params: { state: 'REGED' }, sessid: 'new-session-id' },
          voice_sdk_id: 'voice-sdk-id',
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
      .then((sessionId: string | null) => {
        loginFinished = true;
        return sessionId;
      });

    for (let index = 0; index < 5; index += 1) {
      await Promise.resolve();
    }

    expect(onSessionId).toHaveBeenCalledWith('new-session-id');
    expect(loginFinished).toBe(false);

    onMessage({ method: 'telnyx_rtc.clientReady' });
    await expect(login).resolves.toBe('new-session-id');
  });
});
