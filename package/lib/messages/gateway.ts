import uuid from 'uuid-random';
import { TelnyxRTCMethod } from './methods';
type ClientReadyEvent = {
  id: number;
  jsonrpc: '2.0';
  method: 'telnyx_rtc.clientReady';
  params: {
    reattached_sessions: [];
  };
  voice_sdk_id: string;
};

type GatewayStateResponse = {
  id: string;
  jsonrpc: '2.0';
  result: {
    params: { state: 'REGED' };
    sessid: string;
  };
  voice_sdk_id: string;
};

export function isClientReadyEvent(msg: unknown): msg is ClientReadyEvent {
  if (!msg) {
    return false;
  }
  const temp: Partial<ClientReadyEvent> = msg;
  return temp?.method === TelnyxRTCMethod.CLIENT_READY;
}

export function createGetGatewayStateMessage() {
  return {
    jsonrpc: '2.0',
    id: uuid(),
    method: TelnyxRTCMethod.GATEWAY_STATE,
    params: {},
  };
}

export function isValidGatewayStateResponse(msg: unknown): msg is GatewayStateResponse {
  if (!msg) {
    return false;
  }
  const temp: Partial<GatewayStateResponse> = msg;
  return temp.result?.params?.state === 'REGED';
}
