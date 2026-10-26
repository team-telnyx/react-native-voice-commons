/**
 * Signaling transport for the Telnyx RTC WebSocket connection.
 *
 * SECURITY (VSDK-909): the signaling connection must use the platform's
 * DEFAULT TLS certificate and hostname validation, on both Android and iOS.
 * The previous transport (`react-native-websocket-self-signed`) unconditionally
 * accepted any certificate for any host — an empty `checkServerTrusted` plus an
 * always-true `hostnameVerifier` on Android, and an unevaluated `.useCredential`
 * trust answer on iOS — which allowed a network-positioned attacker to
 * intercept the signaling connection and capture login credentials. That module
 * is no longer used or declared as a dependency.
 */

/**
 * Minimal transport surface consumed by `Connection`. Kept identical to the
 * surface the previous transport exposed so the `Connection` semantics
 * (callback registration before connecting, one-shot `close()` teardown of
 * listeners) are preserved.
 */
export interface SignalingSocket {
  onOpen(callback: () => void): void;
  onError(callback: (error: string) => void): void;
  onClose(callback: () => void): void;
  onMessage(callback: (message: string) => void): void;
  connect(): Promise<void>;
  send(message: string): void;
  close(): void;
  removeOnOpenListener(): void;
  removeOnErrorListener(): void;
  removeOnCloseListener(): void;
  removeOnMessageListener(): void;
}

type NativeWebSocket = {
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data?: unknown }) => void) | null;
  onerror: ((event: { message?: unknown }) => void) | null;
  onclose: ((event: unknown) => void) | null;
  readyState: number;
  send(data: string): void;
  close(): void;
};

const CONNECTING = 0;
const OPEN = 1;

/**
 * Creates the signaling transport for `wsUrl` backed by the React Native
 * built-in global `WebSocket`.
 *
 * The built-in `WebSocket` performs platform-default TLS validation on both
 * platforms (OkHttp's default `X509TrustManager` / `HostnameVerifier` on
 * Android; the default `URLSession` trust handling, `.performDefaultHandling`,
 * on iOS). No custom trust manager, hostname verifier, or credential answers
 * are supplied — a proxy or rogue endpoint presenting an untrusted certificate
 * fails the TLS handshake and the connection never opens.
 */
/**
 * Resolves the JavaScript global object for the current runtime without
 * requiring the `globalThis` identifier (VSDK-909).
 *
 * Older JavaScriptCore/Hermes runtimes covered by the package's
 * `react-native >=0.60.0` peer range may not define `globalThis`, and
 * evaluating that identifier as a value throws a synchronous ReferenceError
 * that escapes `connect()` before it can return a rejected promise — so
 * `Connection` could never open signaling at all on those versions.
 * `typeof` never throws for unresolvable identifiers, so the guards below
 * are safe everywhere. React Native exposes the JS context's global object
 * as `global` on every version of the supported range, so it is the
 * fallback.
 */
declare const global: unknown;

export const getGlobalObject = (): Record<string, unknown> | undefined => {
  if (typeof globalThis === 'object' && globalThis !== null) {
    return globalThis as unknown as Record<string, unknown>;
  }
  if (typeof global === 'object' && global !== null) {
    return global as unknown as Record<string, unknown>;
  }
  return undefined;
};

export const createSignalingSocket = (wsUrl: string): SignalingSocket =>
  new DefaultValidatingSocket(wsUrl);

class DefaultValidatingSocket implements SignalingSocket {
  private readonly url: string;
  private socket: NativeWebSocket | null = null;
  private connectPromise: Promise<void> | null = null;
  private ready = false;

  private openListeners: Array<() => void> = [];
  private errorListeners: Array<(error: string) => void> = [];
  private closeListeners: Array<() => void> = [];
  private messageListeners: Array<(message: string) => void> = [];

  constructor(wsUrl: string) {
    this.url = wsUrl;
  }

  public onOpen(callback: () => void): void {
    this.openListeners.push(callback);
  }

  public onError(callback: (error: string) => void): void {
    this.errorListeners.push(callback);
  }

  public onClose(callback: () => void): void {
    this.closeListeners.push(callback);
  }

  public onMessage(callback: (message: string) => void): void {
    this.messageListeners.push(callback);
  }

  public connect(): Promise<void> {
    // Reuse the live instance when a connection is already established. When
    // a handshake is in flight, return that exact promise so every caller
    // observes the eventual open or TLS failure instead of resolving early.
    if (this.socket && this.ready) {
      return Promise.resolve();
    }
    if (this.connectPromise) {
      return this.connectPromise;
    }

    // Resolve the global object through the guarded helper: a bare
    // `globalThis` identifier evaluation can throw a synchronous
    // ReferenceError on older React Native runtimes (see getGlobalObject).
    const globalObject = getGlobalObject();
    const WebSocketImpl =
      globalObject === undefined ? undefined : globalObject.WebSocket;
    if (typeof WebSocketImpl !== 'function') {
      return Promise.reject(
        new Error(
          '[Connection]: React Native global WebSocket is not available; ' +
            'cannot open the signaling connection.'
        )
      );
    }

    this.ready = false;
    // Constructed with the URL only — no custom protocols, trust manager, or
    // hostname verifier: TLS certificate and hostname validation follow the
    // platform defaults (VSDK-909).
    const socket = new (WebSocketImpl as new (url: string) => NativeWebSocket)(
      this.url
    );
    this.socket = socket;

    const connectPromise = new Promise<void>((resolve, reject) => {
      let settled = false;
      const settle = (action: () => void) => {
        if (!settled) {
          settled = true;
          if (this.connectPromise === connectPromise) {
            this.connectPromise = null;
          }
          action();
        }
      };

      socket.onopen = () => {
        this.ready = true;
        this.openListeners.forEach((listener) => listener());
        settle(resolve);
      };

      socket.onmessage = (event) => {
        const data = event.data;
        const message = typeof data === 'string' ? data : String(data);
        this.messageListeners.forEach((listener) => listener(message));
      };

      socket.onerror = (event) => {
        const error =
          typeof event?.message === 'string'
            ? event.message
            : 'WebSocket error';
        this.errorListeners.forEach((listener) => listener(error));
        // A TLS handshake failure (untrusted certificate, wrong hostname)
        // surfaces as onerror/onclose without onopen ever firing — reject so
        // callers do not treat the connection as established.
        settle(() => reject(new Error(error)));
      };

      socket.onclose = () => {
        if (this.socket === socket) {
          this.socket = null;
          this.ready = false;
        }
        this.closeListeners.forEach((listener) => listener());
        settle(() => reject(new Error('Connection closed')));
      };
    });
    this.connectPromise = connectPromise;
    return connectPromise;
  }

  public send(message: string): void {
    if (!this.socket || this.socket.readyState !== OPEN || !this.ready) {
      throw new Error(
        '[Connection]: Cannot send — signaling socket is not connected.'
      );
    }
    this.socket.send(message);
  }

  public close(): void {
    const socket = this.socket;
    if (!socket) {
      return;
    }
    if (socket.readyState === CONNECTING || socket.readyState === OPEN) {
      socket.close();
    }
  }

  public removeOnOpenListener(): void {
    this.openListeners = [];
  }

  public removeOnErrorListener(): void {
    this.errorListeners = [];
  }

  public removeOnCloseListener(): void {
    this.closeListeners = [];
  }

  public removeOnMessageListener(): void {
    this.messageListeners = [];
  }
}
