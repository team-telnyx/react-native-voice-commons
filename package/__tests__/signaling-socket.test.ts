/**
 * Unit tests for the signaling transport (`lib/signaling-socket`).
 *
 * SECURITY (VSDK-909): these tests pin the security-relevant contract —
 * the transport must construct the platform's built-in WebSocket with the
 * URL only (no custom trust options), so TLS certificate and hostname
 * validation follow platform defaults. An untrusted certificate must fail
 * the handshake: `connect()` rejects without ever dispatching open.
 */

const WS_URL = 'wss://rtc.telnyx.com/wss';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static constructorCalls: unknown[][] = [];

  url: string;
  readyState = 0; // CONNECTING
  closeCalled = false;
  sent: string[] = [];
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data?: unknown }) => void) | null = null;
  onerror: ((event: { message?: unknown }) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;

  constructor(...args: unknown[]) {
    FakeWebSocket.constructorCalls.push(args);
    this.url = String(args[0]);
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3; // CLOSED
    this.closeCalled = true;
    if (this.onclose) {
      this.onclose({});
    }
  }

  // Test helpers simulating native events.
  simulateOpen(): void {
    this.readyState = 1; // OPEN
    if (this.onopen) {
      this.onopen({});
    }
  }

  simulateMessage(data: string): void {
    if (this.onmessage) {
      this.onmessage({ data });
    }
  }

  simulateError(message?: string): void {
    if (this.onerror) {
      this.onerror(message ? { message } : {});
    }
  }
}

describe('createSignalingSocket (platform-default TLS validation)', () => {
  let originalWebSocket: unknown;

  beforeEach(() => {
    originalWebSocket = (globalThis as Record<string, unknown>).WebSocket;
    (globalThis as Record<string, unknown>).WebSocket = FakeWebSocket;
    FakeWebSocket.instances = [];
    FakeWebSocket.constructorCalls = [];
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).WebSocket = originalWebSocket;
  });

  it('constructs the built-in WebSocket with the URL only — no custom trust options', async () => {
    const { createSignalingSocket } = require('../lib/signaling-socket');
    const socket = createSignalingSocket(WS_URL);
    socket.connect().catch(() => undefined); // fire-and-forget like Connection does

    expect(FakeWebSocket.constructorCalls).toHaveLength(1);
    // SECURITY: exactly one constructor argument (the URL). Any second
    // argument (custom options / trust configuration) must fail this test.
    expect(FakeWebSocket.constructorCalls[0]).toEqual([WS_URL]);
  });

  it('resolves connect() when the socket opens and dispatches onOpen listeners', async () => {
    const { createSignalingSocket } = require('../lib/signaling-socket');
    const socket = createSignalingSocket(WS_URL);
    const opened = jest.fn();
    socket.onOpen(opened);

    const pending = socket.connect();
    expect(opened).not.toHaveBeenCalled();

    FakeWebSocket.instances[0].simulateOpen();
    await expect(pending).resolves.toBeUndefined();
    expect(opened).toHaveBeenCalledTimes(1);
  });

  it('forwards inbound frames to onMessage listeners as strings', async () => {
    const { createSignalingSocket } = require('../lib/signaling-socket');
    const socket = createSignalingSocket(WS_URL);
    const received: string[] = [];
    socket.onMessage((message) => received.push(message));

    const pending = socket.connect();
    const native = FakeWebSocket.instances[0];
    native.simulateOpen();
    await pending;

    native.simulateMessage('{"jsonrpc":"2.0"}');
    expect(received).toEqual(['{"jsonrpc":"2.0"}']);
  });

  it('rejects connect() on a failed handshake (untrusted certificate) instead of treating the connection as open', async () => {
    const { createSignalingSocket } = require('../lib/signaling-socket');
    const socket = createSignalingSocket(WS_URL);
    const opened = jest.fn();
    const errored: string[] = [];
    socket.onOpen(opened);
    socket.onError((error) => errored.push(error));

    const pending = socket.connect();
    FakeWebSocket.instances[0].simulateError('TLS handshake failed');
    await expect(pending).rejects.toThrow('TLS handshake failed');
    expect(opened).not.toHaveBeenCalled();
    expect(errored).toEqual(['TLS handshake failed']);
  });

  it('rejects connect() when the socket closes before opening', async () => {
    const { createSignalingSocket } = require('../lib/signaling-socket');
    const socket = createSignalingSocket(WS_URL);

    const pending = socket.connect();
    FakeWebSocket.instances[0].close();
    await expect(pending).rejects.toThrow('Connection closed');
  });

  it('throws on send() before the socket is open and passes frames to the native socket once open', async () => {
    const { createSignalingSocket } = require('../lib/signaling-socket');
    const socket = createSignalingSocket(WS_URL);

    expect(() => socket.send('early')).toThrow(/not connected/i);

    const pending = socket.connect();
    const native = FakeWebSocket.instances[0];
    native.simulateOpen();
    await pending;

    socket.send('{"jsonrpc":"2.0"}');
    expect(native.sent).toEqual(['{"jsonrpc":"2.0"}']);
  });

  it('closes the native socket and stops dispatching listeners after removeOn*Listener', async () => {
    const { createSignalingSocket } = require('../lib/signaling-socket');
    const socket = createSignalingSocket(WS_URL);
    const closed = jest.fn();
    const messaged = jest.fn();
    socket.onClose(closed);
    socket.onMessage(messaged);

    const pending = socket.connect();
    const native = FakeWebSocket.instances[0];
    native.simulateOpen();
    await pending;

    socket.removeOnCloseListener();
    socket.removeOnMessageListener();
    socket.close();

    expect(native.closeCalled).toBe(true);
    expect(closed).not.toHaveBeenCalled();
    native.simulateMessage('after-teardown');
    expect(messaged).not.toHaveBeenCalled();
  });

  it('does not open a second native instance while a connection is in flight', async () => {
    const { createSignalingSocket } = require('../lib/signaling-socket');
    const socket = createSignalingSocket(WS_URL);

    void socket.connect();
    await socket.connect(); // deduped: resolves without a new instance

    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('creates a fresh native instance on reconnect and re-dispatches listeners', async () => {
    const { createSignalingSocket } = require('../lib/signaling-socket');
    const socket = createSignalingSocket(WS_URL);
    const opened = jest.fn();
    socket.onOpen(opened);

    const first = socket.connect();
    FakeWebSocket.instances[0].simulateOpen();
    await first;

    FakeWebSocket.instances[0].close(); // server-side close

    const second = socket.connect();
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(FakeWebSocket.instances[1]).not.toBe(FakeWebSocket.instances[0]);
    expect(FakeWebSocket.constructorCalls[1]).toEqual([WS_URL]);

    FakeWebSocket.instances[1].simulateOpen();
    await second;
    expect(opened).toHaveBeenCalledTimes(2);
  });

  it('rejects cleanly when no global WebSocket implementation exists', async () => {
    (globalThis as Record<string, unknown>).WebSocket = undefined;
    const { createSignalingSocket } = require('../lib/signaling-socket');
    const socket = createSignalingSocket(WS_URL);

    await expect(socket.connect()).rejects.toThrow(/WebSocket is not available/);
    expect(FakeWebSocket.instances).toHaveLength(0);
  });
});
