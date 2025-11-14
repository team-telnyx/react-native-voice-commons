export type Message = {
  id: string;
  jsonrpc: '2.0';
};

export function isMessage(payload: unknown): payload is Message {
  const temp = payload as Message | undefined;
  if (!temp || typeof temp !== 'object') {
    return false;
  }
  return !!temp.id && temp.jsonrpc === '2.0';
}
