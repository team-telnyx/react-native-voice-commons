import { EventEmitter } from 'eventemitter3';
import { TelnyxRTC } from '../lib/client';
import { Connection } from '../lib/connection';
import { LoginHandler } from '../lib/login-handler';
import { Call } from '../lib/call';

let mockLogin: jest.Mock;
let mockSocketReady: boolean;

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(() => Promise.resolve({ isInternetReachable: true, type: 'wifi' })),
    addEventListener: jest.fn(() => jest.fn()),
  },
  addEventListener: jest.fn(() => jest.fn()),
}));

jest.mock('../lib/connection', () => ({
  Connection: jest.fn(() =>
    Object.assign(new (require('eventemitter3').EventEmitter)(), {
      isConnected: mockSocketReady,
      close: jest.fn(),
    })
  ),
}));

jest.mock('../lib/login-handler', () => ({
  LoginHandler: jest.fn(() => ({
    login: mockLogin,
    cancelPendingLogin: jest.fn(),
  })),
}));

jest.mock('../lib/keep-alive-handler', () => ({
  KeepAliveHandler: jest.fn(() => ({
    start: jest.fn(),
    stop: jest.fn(),
  })),
}));

const socket = (index: number): EventEmitter =>
  (Connection as unknown as jest.Mock).mock.results[index].value;
const push = (id: string, route?: string) => ({
  metadata: { call_id: id, voice_sdk_id: route },
  action: 'answer',
  from_notification: true,
});

describe('TelnyxRTC signaling ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSocketReady = true;
    mockLogin = jest.fn(async (_options, confirm) => {
      confirm('confirmed-session', 'confirmed-route');
      return 'registered-session';
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('publishes early session identity and ignores an old login completion after reconnect', async () => {
    let finishLogin: (id: string) => void;
    mockLogin.mockImplementationOnce((_options, confirm) => {
      confirm('old-session', 'old-route');
      return new Promise<string>((resolve) => {
        finishLogin = resolve;
      });
    });

    const client = new TelnyxRTC({ login_token: 'test-token' });
    const stale = expect(client.connect()).rejects.toThrow('connection has been canceled');
    expect(client.sessionId).toBe('old-session');

    client.disconnect();
    await client.connect();
    finishLogin('stale-session');
    await stale;
    expect(client.sessionId).toBe('registered-session');
    expect(Connection).toHaveBeenLastCalledWith(undefined, undefined);
    expect(mockLogin.mock.calls[1][2]).toEqual({ fromPush: false, sessionId: undefined });
  });

  it('recovers with the confirmed session and route on the same client and environment', async () => {
    const client = new TelnyxRTC({
      login: 'sip-user',
      password: 'test-password',
      environment: 'development',
    });
    await client.connect();
    (client as any).onNetworkUnavailable();
    await (client as any).attemptReconnection();

    expect(Connection).toHaveBeenLastCalledWith('confirmed-route', 'development');
    expect(mockLogin.mock.calls[1][2]).toEqual({ fromPush: false, sessionId: 'confirmed-session' });
  });

  it('preserves a pending push route and answer across network recovery before INVITE', async () => {
    const client = new TelnyxRTC({ login_token: 'test-token' });
    mockLogin.mockImplementationOnce(async (_options, confirm) => {
      confirm('confirmed-session', 'push-route');
      return 'registered-session';
    });
    client.processVoIPNotification(push('a', 'push-route'));
    await client.connect();
    (client as any).onNetworkUnavailable();
    await (client as any).attemptReconnection();

    expect(Connection).toHaveBeenLastCalledWith('push-route', undefined);
    expect(mockLogin.mock.calls[1][2]).toEqual({ fromPush: true, sessionId: 'confirmed-session' });
    expect(client.getPushNotificationCallKitUUID()).toBe('a');
  });

  it('does not let an old socket failure erase the next push or lend it its route', async () => {
    mockSocketReady = false;
    const client = new TelnyxRTC({ login_token: 'test-token' });
    client.processVoIPNotification(push('a', 'route-a'));
    const stale = expect(client.connect()).rejects.toThrow('connection closed');
    client.disconnect();
    client.processVoIPNotification(push('b'));
    const current = client.connect();

    socket(0).emit('telnyx.socket.close');
    socket(1).emit('telnyx.socket.open');
    await stale;
    await current;
    expect(Connection).toHaveBeenLastCalledWith(undefined, undefined);
    expect(LoginHandler).toHaveBeenCalledTimes(1);
    expect(mockLogin.mock.calls[0][2]).toEqual({ fromPush: true, sessionId: undefined });
    expect(client.getPushNotificationCallKitUUID()).toBe('b');
  });

  it('consumes notification answer for its INVITE, and an asynchronous answer failure leaves the next push intact', async () => {
    const client = new TelnyxRTC({ login_token: 'test-token' });
    let failAnswer: (error: Error) => void;
    const answer = jest.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          failAnswer = reject;
        })
    );
    const inbound = { callId: 'signal-a', state: 'ringing', answer, on: jest.fn() };
    jest.spyOn(Call, 'createInboundCall').mockResolvedValueOnce(inbound as any);
    client.processVoIPNotification(push('a', 'route-a'));
    await client.connect();
    await (client as any).processInvite({ params: { callID: 'signal-a', sdp: 'sdp' } });

    expect(answer).toHaveBeenCalledTimes(1);
    expect(client.getPushNotificationCallKitUUID()).toBeNull();
    client.processVoIPNotification(push('b', 'route-b'));
    failAnswer(new Error('late answer error'));
    await Promise.resolve();

    expect(client.getPushNotificationCallKitUUID()).toBe('b');
    expect((client as any).pushVoiceSDKId).toBe('route-b');
  });
});
