// LOCAL-DEBUG ONLY — do not ship in a release branch.
// Logs every verto/JSON-RPC frame flowing over the WebSocket through the
// native CallKitBridge.publicLog method (os_log, %{public}@) so entries
// show in Console.app even in release builds. Falls back to console on
// non-iOS or when the native bridge is unavailable (e.g. unit tests).
//
// WARNING: Payloads include login credentials and SDP bodies. Strip them
// before sharing logs.

let bridge: any = null;
try {
  const rn = require('react-native');
  bridge = rn?.Platform?.OS === 'ios' ? rn.NativeModules?.CallKitBridge : null;
} catch {
  bridge = null;
}

function emit(tag: string, message: string): void {
  // eslint-disable-next-line no-console
  console.log(`[TX:${tag}]`, message);
  if (bridge && typeof bridge.publicLog === 'function') {
    try {
      bridge.publicLog(tag, 'info', message).catch(() => {});
    } catch {
      /* swallow */
    }
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    try {
      return String(value);
    } catch {
      return '[unserializable]';
    }
  }
}

function extractMethodAndId(msg: any): { method: string; id: string } {
  if (!msg || typeof msg !== 'object') {
    return { method: 'raw', id: '-' };
  }
  const method = typeof msg.method === 'string' ? msg.method : msg.result ? 'response' : 'event';
  const id = typeof msg.id === 'string' || typeof msg.id === 'number' ? String(msg.id) : '-';
  return { method, id };
}

export function logVertoOutbound(msg: unknown): void {
  const { method, id } = extractMethodAndId(msg);
  emit('Verto.OUT', `method=${method} id=${id} body=${safeStringify(msg)}`);
}

export function logVertoInbound(msg: unknown): void {
  const { method, id } = extractMethodAndId(msg);
  emit('Verto.IN', `method=${method} id=${id} body=${safeStringify(msg)}`);
}

export function logVertoEvent(tag: string, message: string): void {
  emit(`Verto.${tag}`, message);
}
