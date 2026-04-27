import uuid from 'uuid-random';
import type { CallOptions } from '../call-options';
import { SDK_VERSION } from '../env';
import { TelnyxRTCMethod } from './methods';

type InviteACKMessage = {
  id: string;
  jsonrpc: '2.0';
  result: {
    callID: string;
    message: 'CALL CREATED';
    sessid: string;
  };
  voice_sdk_id: string;
};

type CreateInviteMessageParams = {
  sessionId: string;
  sdp: string;
  attach: boolean;
  callId: string;
  callOptions: CallOptions;
};

export function createInviteMessage({
  sdp,
  sessionId,
  attach,
  callId,
  callOptions,
}: CreateInviteMessageParams) {
  return {
    id: uuid(),
    jsonrpc: '2.0',
    method: TelnyxRTCMethod.INVITE,
    params: {
      sessid: sessionId,
      sdp,
      'User-Agent': `ReactNative-${SDK_VERSION}`,
      dialogParams: {
        attach,
        callID: callId,
        audio: callOptions.audio,
        prefetchIceCandidates: callOptions.peerConnectionOptions?.prefetchIceCandidates,
        destination_number: callOptions.destinationNumber,
        remote_caller_id_name: callOptions.remoteCallerIdName,
        remote_caller_id_number: callOptions.remoteCallerIdNumber,
        caller_id_name: callOptions.callerIdName,
        caller_id_number: callOptions.callerIdNumber,
        custom_headers: callOptions.customHeaders,
        clientState: callOptions.clientState,
      },
    },
  };
}

export function isInviteACKMessage(msg: unknown): msg is InviteACKMessage {
  if (!msg) {
    return false;
  }
  const temp: Partial<InviteACKMessage> = msg;
  return (
    Boolean(temp.result?.callID) &&
    Boolean(temp.result?.sessid) &&
    temp.result?.message === 'CALL CREATED'
  );
}

export type RingingEvent = {
  id: number;
  jsonrpc: '2.0';
  method: 'telnyx_rtc.ringing';
  params: {
    callID: string;
    callee_id_name: string;
    callee_id_number: string;
    caller_id_name: string;
    caller_id_number: string;
    dialogParams: {
      custom_headers: { name: string; value: string }[];
    };
    display_direction: string;
    telnyx_leg_id: string;
    telnyx_session_id: string;
  };
  voice_sdk_id: string;
};

export function isRingingEvent(msg: unknown): msg is RingingEvent {
  if (!msg) {
    return false;
  }
  const temp: Partial<RingingEvent> = msg;
  return (
    temp.method === TelnyxRTCMethod.RINGING &&
    Boolean(temp.params?.callID) &&
    Boolean(temp.params?.telnyx_leg_id) &&
    Boolean(temp.params?.telnyx_session_id)
  );
}

export type AnswerEvent = {
  id: number;
  jsonrpc: '2.0';
  method: 'telnyx_rtc.answer';
  params: {
    callID: string;
    dialogParams: { custom_headers: { name: string; value: string }[] };
    sdp?: string; // Made optional since SDP might come via media event instead
    variables: {
      'Core-UUID': string;
    };
    /** The Telnyx call control ID for outbound flows (parked & bridged) */
    telnyx_call_control_id?: string;
    /** The Telnyx leg ID */
    telnyx_leg_id?: string;
    /** The Telnyx session ID */
    telnyx_session_id?: string;
  };
  voice_sdk_id: string;
};

export function isAnswerEvent(msg: unknown): msg is AnswerEvent {
  if (!msg) {
    return false;
  }
  const temp: Partial<AnswerEvent> = msg;
  return temp.method === TelnyxRTCMethod.ANSWER && Boolean(temp.params?.callID);
}

export function isByeEvent(msg: unknown): msg is ByeEvent {
  if (!msg) {
    return false;
  }
  const temp: Partial<ByeEvent> = msg;
  return (
    temp.method === TelnyxRTCMethod.BYE && Boolean(temp.params?.callID) && Boolean(temp.params?.cause)
  );
}

export type ByeEvent = {
  id: number;
  jsonrpc: '2.0';
  method: 'telnyx_rtc.bye';
  params: {
    callID: string;
    cause: string;
    causeCode: number;
    dialogParams: { custom_headers: { name: string; value: string }[] };
    sipCode: number;
    sipReason: string;
    sip_call_id: string;
  };
  voice_sdk_id: string;
};

type HangupRequest = {
  jsonrpc: '2.0';
  id: string;
  method: 'telnyx_rtc.bye';
  params: {
    sessid: string;
    dialogParams: {
      telnyxSessionId: string;
      telnyxLegId: string;
      callID: string;
      custom_headers?: { name: string; value: string }[];
    };
    cause: string;
    causeCode: number;
  };
};

type CreateHangupRequestParams = {
  sessionId: string;
  cause: string;
  causeCode: number;
  telnyxSessionId: string;
  telnyxLegId: string;
  callId: string;
  customHeaders?: { name: string; value: string }[];
};
export function createHangupRequest({
  cause,
  causeCode,
  sessionId,
  callId,
  telnyxLegId,
  telnyxSessionId,
  customHeaders,
}: CreateHangupRequestParams): HangupRequest {
  return {
    id: uuid(),
    jsonrpc: '2.0',
    method: TelnyxRTCMethod.BYE,
    params: {
      sessid: sessionId,
      cause: cause,
      causeCode: causeCode,
      dialogParams: {
        telnyxSessionId,
        telnyxLegId,
        callID: callId,
        custom_headers: customHeaders || [],
      },
    },
  };
}

export type InviteEvent = {
  id: number;
  jsonrpc: '2.0';
  method: 'telnyx_rtc.invite';
  params: {
    callID: string;
    callee_id_name: string;
    callee_id_number: string;
    caller_id_name: string;
    caller_id_number: string;
    dialogParams: {
      custom_headers: { name: string; value: string }[];
    };
    display_direction: string;
    sdp?: string; // Made optional since SDP can come via media event
    telnyx_leg_id: string;
    telnyx_session_id: string;
  };
  voice_sdk_id: string;
};

export function isInviteEvent(msg: unknown): msg is InviteEvent {
  if (!msg) {
    return false;
  }
  const temp: Partial<InviteEvent> = msg;
  return temp.method === TelnyxRTCMethod.INVITE && Boolean(temp.params?.callID);
}

type AnswerMessage = {
  jsonrpc: '2.0';
  id: string;
  method: 'telnyx_rtc.answer';
  params: {
    sessid: string;
    sdp: string;
    dialogParams: {
      telnyxSessionId: string;
      telnyxLegId: string;
      callID: string;
      custom_headers?: { name: string; value: string }[];
    };
    'User-Agent': string;
  };
};

type CreateAnswerMessageParams = {
  sessionId: string;
  sdp: string;
  dialogParams: object;
  callId: string;
  telnyxSessionId: string;
  telnyxLegId: string;
  customHeaders?: { name: string; value: string }[];
};
export function createAnswerMessage({
  dialogParams,
  sdp,
  sessionId,
  callId,
  telnyxLegId,
  telnyxSessionId,
  customHeaders,
}: CreateAnswerMessageParams): AnswerMessage {
  return {
    id: uuid(),
    jsonrpc: '2.0',
    method: TelnyxRTCMethod.ANSWER,
    params: {
      sessid: sessionId,
      sdp,
      dialogParams: {
        callID: callId,
        telnyxLegId,
        telnyxSessionId,
        custom_headers: customHeaders || [],
        ...dialogParams,
      },
      'User-Agent': `ReactNative-${SDK_VERSION}`,
    },
  };
}

type ModifyCallRequest = {
  jsonrpc: '2.0';
  id: string;
  method: 'telnyx_rtc.modify';
  params: {
    sessid: string;
    action: 'hold' | 'unhold';
    dialogParams: object;
  };
};

export function createModifyCallRequest({
  sessionId,
  action,
  callId,
}: {
  callId: string;
  sessionId: string;
  action: 'hold' | 'unhold';
}): ModifyCallRequest {
  return {
    jsonrpc: '2.0',
    id: uuid(),
    method: TelnyxRTCMethod.MODIFY,
    params: {
      sessid: sessionId,
      action,
      dialogParams: { callId },
    },
  };
}

type ModifyCallAnswer = {
  id: string;
  jsonrpc: '2.0';
  result: {
    action: 'hold' | 'unhold';
    callID: string;
    holdState: 'held' | 'unheld';
    sessid: string;
  };
  voice_sdk_id: string;
};

export function isModifyCallAnswer(msg: unknown): msg is ModifyCallAnswer {
  if (!msg) {
    return false;
  }
  const temp: Partial<ModifyCallAnswer> = msg;
  return (
    Boolean(temp.result?.callID) &&
    Boolean(temp.result?.sessid) &&
    (temp.result?.holdState === 'held' || temp.result?.holdState === 'unheld')
  );
}

/**
 * Verto `telnyx_rtc.info` request used to send DTMF tones.
 *
 * Mirrors the shape produced by the Android Voice SDK so the gateway sees a
 * consistent payload across platforms — including the full `dialogParams`
 * object with empty-but-present defaults for fields we don't track.
 */
type DTMFRequest = {
  jsonrpc: '2.0';
  id: string;
  method: 'telnyx_rtc.info';
  params: {
    sessid: string;
    dtmf: string;
    dialogParams: {
      attach: boolean;
      audio: boolean;
      callID: string;
      caller_id_name: string;
      caller_id_number: string;
      clientState: string;
      custom_headers: { name: string; value: string }[];
      destination_number: string;
      remote_caller_id_name: string;
      screenShare: boolean;
      useStereo: boolean;
      userVariables: unknown[];
      video: boolean;
    };
  };
};

type CreateDTMFRequestParams = {
  digits: string;
  sessionId: string;
  callId: string;
  callerIdName?: string;
  callerIdNumber?: string;
  clientState?: string;
  customHeaders?: { name: string; value: string }[];
  destinationNumber?: string;
  remoteCallerIdName?: string;
};

export function createDTMFRequest(params: CreateDTMFRequestParams): DTMFRequest {
  return {
    id: uuid(),
    jsonrpc: '2.0',
    method: TelnyxRTCMethod.INFO,
    params: {
      sessid: params.sessionId,
      dtmf: params.digits,
      dialogParams: {
        attach: false,
        audio: true,
        callID: params.callId,
        caller_id_name: params.callerIdName ?? '',
        caller_id_number: params.callerIdNumber ?? '',
        clientState: params.clientState ?? '',
        custom_headers: params.customHeaders ?? [],
        destination_number: params.destinationNumber ?? '',
        remote_caller_id_name: params.remoteCallerIdName ?? '',
        screenShare: false,
        useStereo: false,
        userVariables: [],
        video: false,
      },
    },
  };
}

type DTMFResponse = {
  id: string;
  jsonrpc: '2.0';
  // `message` is legacy — the Telnyx gateway currently acks DTMF with just `sessid`.
  // Kept optional so older servers that still emit `{ message: 'SENT', sessid }` still type-check.
  result: { message?: string; sessid: string };
  voice_sdk_id?: string;
};

export function isDTMFResponse(msg: unknown): msg is DTMFResponse {
  if (!msg || typeof msg !== 'object') {
    return false;
  }
  const temp = msg as Partial<DTMFResponse>;
  // A DTMF ack is any JSON-RPC success response for a `telnyx_rtc.info` request
  // that echoes back the session id. The Android SDK's `Call.dtmf()` doesn't
  // validate the response at all (fire-and-forget); this check is just enough
  // to distinguish the success ack from a JSON-RPC error frame.
  return Boolean(temp.result?.sessid);
}
