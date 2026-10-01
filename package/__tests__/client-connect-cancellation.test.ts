import AsyncStorage from '@react-native-async-storage/async-storage';
import { TelnyxRTC } from '../lib/client';
import { Connection } from '../lib/connection';

let mockResolvePushState: ((value: string | null) => void) | undefined;

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(() => Promise.resolve({ isInternetReachable: true, type: 'wifi' })),
    addEventListener: jest.fn(() => jest.fn()),
  },
  addEventListener: jest.fn(() => jest.fn()),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(
      () =>
        new Promise<string | null>((resolve) => {
          mockResolvePushState = resolve;
        })
    ),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../lib/connection', () => ({
  Connection: jest.fn(() => ({
    _client: null,
    isConnected: true,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    close: jest.fn(),
  })),
}));

jest.mock('../lib/login-handler', () => ({
  LoginHandler: jest.fn(() => ({
    login: jest.fn(() => Promise.resolve('sessid')),
    setAttachCall: jest.fn(),
    setFromPush: jest.fn(),
    cancelPendingLogin: jest.fn(),
  })),
}));

jest.mock('../lib/keep-alive-handler', () => ({
  KeepAliveHandler: jest.fn(() => ({
    start: jest.fn(),
    stop: jest.fn(),
  })),
}));

describe('TelnyxRTC connect cancellation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolvePushState = undefined;
  });

  it('does not create a WebSocket when disconnect cancels a pre-socket connect', async () => {
    const client = new TelnyxRTC({ login: 'sip-user', password: 'sip-password' });
    const connectResult = client.connect().then(
      () => undefined,
      (error: Error) => error
    );

    await Promise.resolve();

    expect(AsyncStorage.getItem).toHaveBeenCalledWith('@telnyx_push_state');
    expect(Connection).not.toHaveBeenCalled();

    client.disconnect();
    mockResolvePushState?.(null);

    const connectError = await connectResult;
    expect(connectError).toBeInstanceOf(Error);
    expect(connectError?.message).toBe('TelnyxRTC connection has been canceled');
    expect(Connection).not.toHaveBeenCalled();
  });
});
