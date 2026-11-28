import AsyncStorage from '@react-native-async-storage/async-storage';
import { TelnyxRTC } from '../lib/client';
import { Connection } from '../lib/connection';
import { createPasswordLoginMessage, createTokenLoginMessage } from '../lib/messages/login';

// The package's jest config maps `../lib/login-handler` to a mock module. This
// suite exercises the real handler so it can assert the actual wire payload.
jest.mock('../lib/login-handler', () => jest.requireActual('../lib/login-handler.ts'));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock('../lib/connection', () => {
  class MockConnection {
    listeners: Record<string, Array<(...args: any[]) => void>> = {};
    sent: any[] = [];
    isConnected = true;
    closed = false;
    resolveLogin: ((response: any) => void) | null = null;

    constructor(
      public voiceSdkId?: string,
      public environment?: string
    ) {}

    addListener(event: string, listener: (...args: any[]) => void) {
      (this.listeners[event] ||= []).push(listener);
    }

    removeListener(event: string, listener: (...args: any[]) => void) {
      const listeners = this.listeners[event];
      if (!listeners) {
        return;
      }
      this.listeners[event] = listeners.filter((entry) => entry !== listener);
    }

    emit(event: string, ...args: any[]) {
      for (const listener of this.listeners[event] || []) {
        listener(...args);
      }
    }

    close() {
      this.closed = true;
    }

    sendAndWait(message: any) {
      this.sent.push(message);
      if (message.method === 'login') {
        return new Promise((resolve) => {
          this.resolveLogin = resolve;
        });
      }
      return Promise.resolve({
        id: message.id,
        result: { params: { state: 'REGED' }, sessid: 'server-session-id' },
        voice_sdk_id: 'voice-sdk-id',
      });
    }
  }

  return {
    Connection: jest.fn((...args: any[]) => new MockConnection(...args)),
  };
});

const { LoginHandler: ActualLoginHandler } = jest.requireActual('../lib/login-handler.ts');

const PERSISTED_SESSID = 'persisted-session-id';
const SERVER_SESSION_ID = 'server-session-id';

async function flushPromises() {
  for (let index = 0; index < 10; index += 1) {
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
          result: { message: 'logged in', sessid: SERVER_SESSION_ID },
          voice_sdk_id: 'voice-sdk-id',
        };
      }
      return {
        id: message.id,
        result: { params: { state: 'REGED' }, sessid: SERVER_SESSION_ID },
        voice_sdk_id: 'voice-sdk-id',
      };
    }),
  };

  const handler = new ActualLoginHandler(connection as any, {
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

function getConnection(index: number): any {
  const connection = (Connection as unknown as jest.Mock).mock.results[index]?.value;
  if (!connection) {
    throw new Error(`Connection ${index} was not created`);
  }
  return connection;
}

function resolveLogin(connection: any, response: any) {
  if (!connection.resolveLogin) {
    throw new Error('No login request is pending');
  }
  connection.resolveLogin(response);
}

const successfulLoginResponse = (id: unknown) => ({
  id,
  result: { message: 'logged in', sessid: SERVER_SESSION_ID },
  voice_sdk_id: 'voice-sdk-id',
});

describe('push and session identity scoping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
      Promise.resolve(key === '@telnyx_last_sessid' ? PERSISTED_SESSID : null)
    );
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

  it('treats a connect cancelled during login as a fresh login on the next attempt', async () => {
    const client = new TelnyxRTC({ login_token: 'token' });
    const firstConnect = client.connect().then(
      () => undefined,
      (error: Error) => error
    );

    await flushPromises();
    const firstConnection = getConnection(0);
    expect(firstConnection.sent[0].method).toBe('login');

    // Cancel while the login request is still in flight.
    client.disconnect();
    expect(client.sessionId).toBeNull();

    // A late response from the cancelled login must not revive its session.
    resolveLogin(firstConnection, successfulLoginResponse(firstConnection.sent[0].id));
    const connectError = await firstConnect;
    expect(connectError).toBeInstanceOf(Error);
    expect(connectError?.message).toBe('TelnyxRTC connection has been canceled');
    expect(client.sessionId).toBeNull();

    const secondConnect = client.connect().then(
      () => undefined,
      (error: Error) => error
    );
    await flushPromises();

    const secondConnection = getConnection(1);
    expect(secondConnection).not.toBe(firstConnection);
    const secondLoginMessage = secondConnection.sent.find(
      (message: any) => message.method === 'login'
    );
    expect(secondLoginMessage).toBeDefined();
    expect(secondLoginMessage.params).not.toHaveProperty('sessid');
    expect(secondLoginMessage.params).not.toHaveProperty('loginParams');
    expect(secondLoginMessage.params).not.toHaveProperty('from_push');
    expect(secondLoginMessage.params.reconnection).toBe(false);

    resolveLogin(secondConnection, successfulLoginResponse(secondLoginMessage.id));
    await flushPromises();
    secondConnection.emit('telnyx.socket.message', { method: 'telnyx_rtc.clientReady' });
    await flushPromises();

    await expect(secondConnect).resolves.toBeUndefined();
    expect(client.sessionId).toBe(SERVER_SESSION_ID);
  });

  it('supplies push metadata only to the connection that answers that push', async () => {
    const client = new TelnyxRTC({ login_token: 'token', logLevel: 'silent' });
    (client as any).processVoIPNotification({
      metadata: { call_id: 'push-call', voice_sdk_id: 'push-voice-sdk-id' },
    });

    const pushConnect = client.connect().then(
      () => undefined,
      (error: Error) => error
    );
    await flushPromises();

    const pushConnection = getConnection(0);
    expect((Connection as unknown as jest.Mock).mock.calls[0][0]).toBe('push-voice-sdk-id');
    const pushLoginMessage = pushConnection.sent.find((message: any) => message.method === 'login');
    expect(pushLoginMessage.params.from_push).toBe(true);
    expect(pushLoginMessage.params.loginParams).toEqual({ attach_call: 'true' });
    expect(pushLoginMessage.params).not.toHaveProperty('sessid');
    expect(pushLoginMessage.params.reconnection).toBe(false);

    resolveLogin(pushConnection, successfulLoginResponse(pushLoginMessage.id));
    await flushPromises();
    pushConnection.emit('telnyx.socket.message', { method: 'telnyx_rtc.clientReady' });
    await flushPromises();
    await expect(pushConnect).resolves.toBeUndefined();

    // The push consumed its metadata; completing the flow must release it.
    (client as any).resetPushContextIfActionsComplete();
    expect((client as any)._pushVoiceSDKId).toBeNull();
    expect((client as any).isCallFromPush).toBe(false);

    client.disconnect();
    const freshConnect = client.connect().then(
      () => undefined,
      (error: Error) => error
    );
    await flushPromises();

    const freshConnection = getConnection(1);
    expect((Connection as unknown as jest.Mock).mock.calls[1][0]).toBeUndefined();
    const freshLoginMessage = freshConnection.sent.find(
      (message: any) => message.method === 'login'
    );
    expect(freshLoginMessage.params).not.toHaveProperty('loginParams');
    expect(freshLoginMessage.params).not.toHaveProperty('from_push');
    expect(freshLoginMessage.params).not.toHaveProperty('sessid');
    expect(freshLoginMessage.params.reconnection).toBe(false);

    resolveLogin(freshConnection, successfulLoginResponse(freshLoginMessage.id));
    await flushPromises();
    freshConnection.emit('telnyx.socket.message', { method: 'telnyx_rtc.clientReady' });
    await flushPromises();
    await expect(freshConnect).resolves.toBeUndefined();
  });

  it('reclaims the session identity when the client genuinely reconnects', async () => {
    const client = new TelnyxRTC({ login_token: 'token', logLevel: 'silent' });
    const firstConnect = client.connect().then(
      () => undefined,
      (error: Error) => error
    );
    await flushPromises();

    const firstConnection = getConnection(0);
    const firstLoginMessage = firstConnection.sent.find(
      (message: any) => message.method === 'login'
    );
    resolveLogin(firstConnection, successfulLoginResponse(firstLoginMessage.id));
    await flushPromises();
    firstConnection.emit('telnyx.socket.message', { method: 'telnyx_rtc.clientReady' });
    await flushPromises();
    await expect(firstConnect).resolves.toBeUndefined();
    expect(client.sessionId).toBe(SERVER_SESSION_ID);

    (client as any).onNetworkUnavailable();
    (client as any).onNetworkAvailable();
    await flushPromises();

    const reconnectConnection = getConnection(1);
    const reconnectLoginMessage = reconnectConnection.sent.find(
      (message: any) => message.method === 'login'
    );
    expect(reconnectLoginMessage.params.sessid).toBe(PERSISTED_SESSID);
    expect(reconnectLoginMessage.params.reconnection).toBe(true);
    expect(reconnectLoginMessage.params.loginParams).toEqual({ attach_call: 'true' });
    expect(reconnectLoginMessage.params).not.toHaveProperty('from_push');

    resolveLogin(reconnectConnection, successfulLoginResponse(reconnectLoginMessage.id));
    await flushPromises();
    reconnectConnection.emit('telnyx.socket.message', { method: 'telnyx_rtc.clientReady' });
    await flushPromises();
    expect((client as any).reconnecting).toBe(false);
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
    expect(client.getPushNotificationCallKitUUID()).toBe('first-push');

    (client as any).processVoIPNotification({
      metadata: { call_id: 'second-push' },
    });
    expect((client as any)._pushVoiceSDKId).toBeNull();
    expect(client.getPushNotificationCallKitUUID()).toBe('second-push');

    (client as any).processVoIPNotification({
      metadata: { voice_sdk_id: 'third-push-voice-sdk-id' },
    });
    expect(client.getPushNotificationCallKitUUID()).toBeNull();
  });

  it('clears push metadata on explicit disconnect so a later login starts fresh', () => {
    const client = new TelnyxRTC({ logLevel: 'silent' });
    (client as any).isCallFromPush = true;
    (client as any).pushNotificationPayload = { metadata: { call_id: 'push-call' } };
    (client as any).pushNotificationCallKitUUID = 'push-call';
    (client as any)._pushVoiceSDKId = 'stale-push-voice-sdk-id';
    (client as any).sessionId = 'stale-session-id';

    client.disconnect();

    expect((client as any).isCallFromPush).toBe(false);
    expect((client as any).pushNotificationPayload).toBeNull();
    expect((client as any).pushNotificationCallKitUUID).toBeNull();
    expect((client as any)._pushVoiceSDKId).toBeNull();
    expect(client.sessionId).toBeNull();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@telnyx_push_state');
  });
});
