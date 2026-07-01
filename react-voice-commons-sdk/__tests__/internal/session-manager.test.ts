jest.mock('@telnyx/react-native-voice-sdk', () => {
  return {
    TelnyxRTC: jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      disablePushNotification: jest.fn(),
      processVoIPNotification: jest.fn(),
    })),
  };
});

import { SessionManager } from '../../src/internal/session/session-manager';
import { TelnyxConnectionState } from '../../src/models/connection-state';
import { createCredentialConfig, createTokenConfig } from '../../src/models/config';

describe('SessionManager reconnect', () => {
  let sessionManager: SessionManager;
  let states: TelnyxConnectionState[];

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    sessionManager = new SessionManager();
    states = [];
    sessionManager.connectionState$.subscribe((state) => states.push(state));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('emits RECONNECTING before CONNECTING on reconnectWithCredential', async () => {
    const config = createCredentialConfig('user', 'pass');
    await sessionManager.reconnectWithCredential(config);

    const reconnectingIdx = states.indexOf(TelnyxConnectionState.RECONNECTING);
    const connectingIdx = states.indexOf(TelnyxConnectionState.CONNECTING);

    expect(reconnectingIdx).toBeGreaterThanOrEqual(0);
    expect(connectingIdx).toBeGreaterThanOrEqual(0);
    expect(reconnectingIdx).toBeLessThan(connectingIdx);
  });

  it('emits RECONNECTING before CONNECTING on reconnectWithToken', async () => {
    const config = createTokenConfig('my-token');
    await sessionManager.reconnectWithToken(config);

    const reconnectingIdx = states.indexOf(TelnyxConnectionState.RECONNECTING);
    const connectingIdx = states.indexOf(TelnyxConnectionState.CONNECTING);

    expect(reconnectingIdx).toBeGreaterThanOrEqual(0);
    expect(connectingIdx).toBeGreaterThanOrEqual(0);
    expect(reconnectingIdx).toBeLessThan(connectingIdx);
  });

  it('does not emit RECONNECTING on initial connectWithCredential', async () => {
    const config = createCredentialConfig('user', 'pass');
    await sessionManager.connectWithCredential(config);

    expect(states).not.toContain(TelnyxConnectionState.RECONNECTING);
    expect(states).toContain(TelnyxConnectionState.CONNECTING);
  });

  it('does not emit RECONNECTING on initial connectWithToken', async () => {
    const config = createTokenConfig('my-token');
    await sessionManager.connectWithToken(config);

    expect(states).not.toContain(TelnyxConnectionState.RECONNECTING);
    expect(states).toContain(TelnyxConnectionState.CONNECTING);
  });

  it('throws when reconnectWithCredential is called after dispose', () => {
    sessionManager.dispose();
    expect(
      sessionManager.reconnectWithCredential(createCredentialConfig('u', 'p'))
    ).rejects.toThrow('SessionManager has been disposed');
  });

  it('throws when reconnectWithToken is called after dispose', () => {
    sessionManager.dispose();
    expect(
      sessionManager.reconnectWithToken(createTokenConfig('t'))
    ).rejects.toThrow('SessionManager has been disposed');
  });
});
