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
      return { id: 'registered-session', voiceSDKId: 'registered-route' };
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('publishes early session identity and ignores an old login completion after reconnect', async () => {
    let finishLogin: (session: { id: string; voiceSDKId: string }) => void;
    mockLogin.mockImplementationOnce((_options, confirm) => {
      confirm('old-session', 'old-route');
      return new Promise<{ id: string; voiceSDKId: string }>((resolve) => {
        finishLogin = resolve;
      });
    });

    const client = new TelnyxRTC({ login_token: 'test-token' });
    const stale = expect(client.connect()).rejects.toThrow('connection has been canceled');
    expect(client.sessionId).toBe('old-session');
    const answerAttach = jest.fn().mockResolvedValue(undefined);
    const createInboundCall = jest.spyOn(Call, 'createInboundCall').mockResolvedValueOnce({
      callId: 'early-attach',
      state: 'connecting',
      answerAttach,
      cancelRecovery: jest.fn(),
      on: jest.fn(),
    } as unknown as Call);
    const reattached = jest.fn();
    client.on('telnyx.call.reattached', reattached);
    await socket(0).listeners('telnyx.socket.message')[0]({
      method: 'telnyx_rtc.attach',
      params: { callID: 'early-attach', sdp: 'sdp' },
    });
    expect(createInboundCall).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'old-session' })
    );
    expect(answerAttach).toHaveBeenCalledTimes(1);
    expect(reattached).toHaveBeenCalledTimes(1);

    client.disconnect();
    await client.connect();
    finishLogin({ id: 'stale-session', voiceSDKId: 'stale-route' });
    await stale;
    expect(client.sessionId).toBe('registered-session');
    expect(Connection).toHaveBeenLastCalledWith(undefined, undefined);
    expect(mockLogin.mock.calls[1][2]).toEqual({ fromPush: false, sessionId: undefined });
  });

  it('recovers with the REGED session and route on the same client and environment', async () => {
    const client = new TelnyxRTC({
      login: 'sip-user',
      password: 'test-password',
      environment: 'development',
    });
    await client.connect();
    (client as any).onNetworkUnavailable();
    await (client as any).attemptReconnection();

    expect(Connection).toHaveBeenLastCalledWith('registered-route', 'development');
    expect(mockLogin.mock.calls[1][2]).toEqual({
      fromPush: false,
      sessionId: 'registered-session',
    });
  });

  it('preserves a pending push route and answer across network recovery before INVITE', async () => {
    const client = new TelnyxRTC({ login_token: 'test-token' });
    mockLogin.mockImplementationOnce(async (_options, confirm) => {
      confirm('confirmed-session', 'push-route');
      return { id: 'registered-session', voiceSDKId: 'registered-push-route' };
    });
    client.processVoIPNotification(push('a', 'push-route'));
    await client.connect();
    (client as any).onNetworkUnavailable();
    await (client as any).attemptReconnection();

    expect(Connection).toHaveBeenLastCalledWith('registered-push-route', undefined);
    expect(mockLogin.mock.calls[1][2]).toEqual({ fromPush: true, sessionId: 'registered-session' });
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

  it.each(['answer', 'end'])(
    'reserves the push UUID for one concurrent INVITE and routes a late %s to its owner',
    async (action) => {
      const client = new TelnyxRTC({ login_token: 'test-token' });
      let finishPushCall: () => void;
      const pushCallPending = new Promise<void>((resolve) => {
        finishPushCall = resolve;
      });
      const createInboundCall = Call.createInboundCall;
      jest.spyOn(Call, 'createInboundCall').mockImplementation(async (options) => {
        const call = await createInboundCall(options);
        jest.spyOn(call, 'answer').mockResolvedValue(undefined);
        jest.spyOn(call, 'hangup').mockImplementation(() => {});
        if (options.callId === 'push-signaling-id') await pushCallPending;
        return call;
      });
      const incoming = jest.fn();
      client.on('telnyx.call.incoming', incoming);
      client.processVoIPNotification(push('native-uuid', 'push-route'));
      await client.connect();

      const invite = (callID: string) =>
        socket(0).listeners('telnyx.socket.message')[0]({
          method: 'telnyx_rtc.invite',
          params: { callID, sdp: 'sdp' },
        });
      const pushInvite = invite('push-signaling-id');
      await invite('other-signaling-id');
      expect(client.getCall('push-signaling-id')).toBeNull();
      expect(client.getPushNotificationCallKitUUID()).toBe('native-uuid');
      if (action === 'answer') {
        client.queueAnswerFromCallKit('NATIVE-UUID', { 'X-Test': 'late' });
      } else {
        client.queueEndFromCallKit('NATIVE-UUID');
      }
      finishPushCall();
      await pushInvite;

      const owner = client.getCall('push-signaling-id');
      const other = client.getCall('other-signaling-id');
      expect((owner as any)._callKitUUID).toBe('native-uuid');
      expect(other).not.toBeNull();
      expect((other as any)._callKitUUID).toBeUndefined();
      expect(client.getPushNotificationCallKitUUID()).toBeNull();
      expect(other.answer).not.toHaveBeenCalled();
      expect(other.hangup).not.toHaveBeenCalled();
      if (action === 'answer') {
        expect(owner.answer).toHaveBeenCalledTimes(1);
        expect(owner.answer).toHaveBeenCalledWith([{ name: 'X-Test', value: 'late' }]);
        expect(owner.hangup).not.toHaveBeenCalled();
        expect(incoming).toHaveBeenCalledTimes(2);
      } else {
        expect(owner.hangup).toHaveBeenCalledTimes(1);
        expect(owner.answer).not.toHaveBeenCalled();
        expect(incoming.mock.calls.map(([call]) => call)).toEqual([other]);
      }
    }
  );

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
