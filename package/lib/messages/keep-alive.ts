import uuid from 'uuid-random';
type KeepAlivePingEvent = {
  id: number;
  jsonrpc: '2.0';
  method: 'telnyx_rtc.ping';
  params: { serno: number };
  voice_sdk_id: string;
};

export function isKeepAlivePing(msg: unknown): msg is KeepAlivePingEvent {
  if (!msg) {
    return false;
  }
  const temp: Partial<KeepAlivePingEvent> = msg;

  return temp.method === 'telnyx_rtc.ping' && temp.params?.serno !== undefined;
}

export function createKeepAlivePingAck() {
  return {
    id: uuid(),
    jsonrpc: '2.0',
    method: 'telnyx_rtc.ping',
  };
}
