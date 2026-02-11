import { TelnyxRTCMethod } from './methods';

export type MediaEvent = {
  id?: number | string;
  jsonrpc: '2.0';
  method: 'telnyx_rtc.media';
  params: {
    callID: string;
    // SDP for early media/ringback tone
    sdp?: string;
    // audio/video flags indicate enabled (true) or disabled (false)
    audio?: boolean;
    video?: boolean;
    // target indicates which side the change applies to: 'local' or 'remote'
    target?: 'local' | 'remote';
    // optional free-form metadata
    [key: string]: any;
  };
  voice_sdk_id?: string;
};

export function isMediaEvent(msg: unknown): msg is MediaEvent {
  if (!msg || typeof msg !== 'object') {
    return false;
  }
  const tmp = msg as Partial<MediaEvent>;
  return tmp.method === TelnyxRTCMethod.MEDIA && !!(tmp.params && (tmp.params as any).callID);
}

export function createMediaMessage({
  callID,
  audio,
  video,
  target = 'remote',
}: {
  callID: string;
  audio?: boolean;
  video?: boolean;
  target?: 'local' | 'remote';
}) {
  return {
    id: Math.floor(Math.random() * 1000000),
    jsonrpc: '2.0' as const,
    method: TelnyxRTCMethod.MEDIA,
    params: {
      callID,
      audio,
      video,
      target,
    },
  };
}
