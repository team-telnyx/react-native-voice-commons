import AsyncStorage from '@react-native-async-storage/async-storage';
import { TelnyxRTC } from '../lib/client';
import { createPasswordLoginMessage, createTokenLoginMessage } from '../lib/messages/login';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const PERSISTED_SESSID = 'persisted-session-id';

async function flushPromises() {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
}

type LoginContext = {
  fromPush?: boolean;
  attachCall?: boolean;
  reconnecting?: boolean;
};

/**
 * Run a complete LoginHandler login and return the login request that was
 * actually put on the wire.
 */
async function runLogin(context: LoginContext = {}) {
  const { LoginHandler } = jest.requireActual('../lib/login-handler.ts');
  let onMessage: (message: unknown) => void = () => {};
  const sent: any[] = [];

  const connection = {
    addListener: jest.fn((event: string, listener: (message: unknown) => void) => {
      if (event === 'telnyx.socket.message') {
        onMessage = listener;
      }
    }),
    sendAndWait: jest.fn(async (message: any) => {
      sent.push(message);
      if (message.method === 'login') {
        return {
          id: message.id,
          result: { message: 'logged in', sessid: 'server-session-id' },
          voice_sdk_id: 'voice-sdk-id',
        };
      }
      return {
        id: message.id,
        result: { params: { state: 'REGED' }, sessid: 'server-session-id' },
        voice_sdk_id: 'voice-sdk-id',
      };
    }),
  };

  const handler = new LoginHandler(connection as any, {
    name: 'webrtc-react-native',
    version: '1.2.0',
  });

  if (context.fromPush) handler.setFromPush(true);
  if (context.attachCall) handler.setAttachCall(true);
  if (context.reconnecting) handler.setReconnecting(true);

  const login = handler.login({ login_token: 'token' });
  await flushPromises();

  const loginMessage = sent[0];
  onMessage({ method: 'telnyx_rtc.clientReady' });
  await login;

  return loginMessage;
}

describe('push and session identity scoping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(PERSISTED_SESSID);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  it.each(['password', 'token'])(
    'does not add attach or session reattachment fields to a fresh %s login',
    (loginType) => {
      const message =
        loginType === 'password'
          ? createPasswordLoginMessage({ login: 'sip-user', password: 'sip-password' })
          : createTokenLoginMessage({ login_token: 'login-token' });

      expect(message.params).not.toHaveProperty('from_push');
      expect(message.params).not.toHaveProperty('sessid');
      expect(message.params).not.toHaveProperty('loginParams');
      expect(message.params.reconnection).toBe(false);
    }
  );

  it('ignores a persisted session id on a fresh login', async () => {
    const loginMessage = await runLogin();

    expect(loginMessage.params).not.toHaveProperty('sessid');
    expect(loginMessage.params).not.toHaveProperty('loginParams');
    expect(loginMessage.params).not.toHaveProperty('from_push');
    expect(loginMessage.params.reconnection).toBe(false);
  });

  it('scopes push attach metadata to the push connection that consumes it', async () => {
    const pushLoginMessage = await runLogin({ fromPush: true, attachCall: true });

    expect(pushLoginMessage.params.from_push).toBe(true);
    expect(pushLoginMessage.params.loginParams).toEqual({ attach_call: 'true' });
    expect(pushLoginMessage.params).not.toHaveProperty('sessid');
    expect(pushLoginMessage.params.reconnection).toBe(false);

    const laterFreshLoginMessage = await runLogin();

    expect(laterFreshLoginMessage.params).not.toHaveProperty('loginParams');
    expect(laterFreshLoginMessage.params).not.toHaveProperty('from_push');
    expect(laterFreshLoginMessage.params).not.toHaveProperty('sessid');
  });

  it('reuses the persisted session id only for a genuine reconnect', async () => {
    const reconnectLoginMessage = await runLogin({ reconnecting: true });

    expect(reconnectLoginMessage.params.sessid).toBe(PERSISTED_SESSID);
    expect(reconnectLoginMessage.params.reconnection).toBe(true);
    expect(reconnectLoginMessage.params.loginParams).toEqual({ attach_call: 'true' });
    expect(reconnectLoginMessage.params).not.toHaveProperty('from_push');
  });

  it('clears the push voice_sdk_id once the push flow completes', () => {
    const client = new TelnyxRTC({ logLevel: 'silent' });
    (client as any).isCallFromPush = true;
    (client as any).pushNotificationPayload = {
      metadata: { call_id: 'push-call', voice_sdk_id: 'stale-push-voice-sdk-id' },
    };
    (client as any).pushNotificationCallKitUUID = 'push-call';
    (client as any)._pushVoiceSDKId = 'stale-push-voice-sdk-id';

    (client as any).resetPushContextIfActionsComplete();

    expect((client as any).isCallFromPush).toBe(false);
    expect((client as any).pushNotificationPayload).toBeNull();
    expect((client as any).pushNotificationCallKitUUID).toBeNull();
    expect((client as any)._pushVoiceSDKId).toBeNull();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@telnyx_push_state');
  });

  it('does not reuse a previous push voice_sdk_id for a sequential push without one', () => {
    const client = new TelnyxRTC({ logLevel: 'silent' });

    (client as any).processVoIPNotification({
      metadata: { call_id: 'first-push', voice_sdk_id: 'first-push-voice-sdk-id' },
    });
    expect((client as any)._pushVoiceSDKId).toBe('first-push-voice-sdk-id');

    (client as any).processVoIPNotification({
      metadata: { call_id: 'second-push' },
    });
    expect((client as any)._pushVoiceSDKId).toBeNull();
  });
});
