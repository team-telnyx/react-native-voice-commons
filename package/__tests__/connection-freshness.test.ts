let mockSocket: {
  onOpen: jest.Mock;
  onError: jest.Mock;
  onClose: jest.Mock;
  onMessage: jest.Mock;
  connect: jest.Mock;
  send: jest.Mock;
  close: jest.Mock;
  removeOnOpenListener: jest.Mock;
  removeOnErrorListener: jest.Mock;
  removeOnCloseListener: jest.Mock;
  removeOnMessageListener: jest.Mock;
};

let openCallbacks: Array<() => void>;
let messageCallbacks: Array<(message: string) => void>;

jest.mock('react-native-websocket-self-signed', () => ({
  getInstance: jest.fn(() => mockSocket),
}));

describe('Connection freshness tracking (ICE restart recovery)', () => {
  const { Connection } = require('../lib/connection.ts') as typeof import('../lib/connection');
  let connection: InstanceType<typeof Connection>;

  beforeEach(() => {
    openCallbacks = [];
    messageCallbacks = [];
    mockSocket = {
      onOpen: jest.fn((callback: () => void) => {
        openCallbacks.push(callback);
      }),
      onError: jest.fn(),
      onClose: jest.fn(),
      onMessage: jest.fn((callback: (message: string) => void) => {
        messageCallbacks.push(callback);
      }),
      connect: jest.fn(() => Promise.resolve()),
      send: jest.fn(),
      close: jest.fn(),
      removeOnOpenListener: jest.fn(),
      removeOnErrorListener: jest.fn(),
      removeOnCloseListener: jest.fn(),
      removeOnMessageListener: jest.fn(),
    };
    connection = new Connection();
  });

  const openSocket = () => {
    openCallbacks.forEach((callback) => callback());
  };

  const receive = (message: unknown) => {
    const payload = JSON.stringify(message);
    messageCallbacks.forEach((callback) => callback(payload));
  };

  it('reports Infinity freshness before any traffic', () => {
    expect(connection.inboundIdleMs).toBe(Infinity);
    expect(connection.confirmedOutboundIdleMs).toBe(Infinity);
    expect(connection.idleMs).toBe(Infinity);
  });

  it('treats a socket open as total activity but not confirmed traffic', () => {
    openSocket();

    expect(connection.idleMs).not.toBe(Infinity);
    expect(connection.inboundIdleMs).toBe(Infinity);
    expect(connection.confirmedOutboundIdleMs).toBe(Infinity);
  });

  it('does not let one-way outbound sends refresh inbound or confirmed-outbound freshness', () => {
    openSocket();
    connection.send({ id: 'one-way', jsonrpc: '2.0', method: 'telnyx_rtc.ping', params: {} });

    // The outbound send refreshed total idle, but neither confirmed leg.
    expect(connection.idleMs).not.toBe(Infinity);
    expect(connection.inboundIdleMs).toBe(Infinity);
    expect(connection.confirmedOutboundIdleMs).toBe(Infinity);
  });

  it('refreshes inbound freshness on gateway messages without confirming the outbound leg', () => {
    receive({ id: 'event-1', jsonrpc: '2.0', method: 'telnyx_notification', params: {} });

    expect(connection.inboundIdleMs).not.toBe(Infinity);
    expect(connection.confirmedOutboundIdleMs).toBe(Infinity);
  });

  it('refreshes confirmed-outbound freshness only when a response resolves a pending request', async () => {
    openSocket();
    const pending = connection.sendAndWait({ id: 'login' });
    expect(connection.confirmedOutboundIdleMs).toBe(Infinity);

    receive({ id: 'login', jsonrpc: '2.0', result: {} });
    await expect(pending).resolves.toEqual({ id: 'login', jsonrpc: '2.0', result: {} });

    expect(connection.inboundIdleMs).not.toBe(Infinity);
    expect(connection.confirmedOutboundIdleMs).not.toBe(Infinity);
  });

  it('treats a response with no matching pending request as inbound-only', () => {
    receive({ id: 'late-response', jsonrpc: '2.0', result: {} });

    expect(connection.inboundIdleMs).not.toBe(Infinity);
    expect(connection.confirmedOutboundIdleMs).toBe(Infinity);
  });
});
