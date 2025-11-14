import { Platform } from 'react-native';

// const attachMessage = {
//   id: 3546946,
//   jsonrpc: "2.0",
//   method: "telnyx_rtc.attach",
//   params: {
//     callID: "5da8ff55-0981-4659-8438-983a53c56719",
//     callee_id_name: "Outbound Call",
//     callee_id_number: "haythem2",
//     caller_id_name: "haythem1",
//     caller_id_number: "haythem1",
//     dialogParams: {
//       custom_headers: [
//         { name: "X-RTC-CALLID", value: "4c6cb475-f8ad-4a2b-8ee3-74b143071b66" },
//         { name: "X-RTC-SESSID", value: "940f4a1c-763a-48fd-99d6-af4618551d4b" },
//       ],
//     },
//     display_direction: "outbound",
//     sdp: "v=0\r\no=FreeSWITCH 1753331097 1753331099 IN IP4 185.246.41.194\r\ns=FreeSWITCH\r\nc=IN IP4 185.246.41.194\r\nt=0 0\r\na=msid-semantic: WMS GHVvLj3nPKycSfBNZBXwExoFdYHAQ2AQ\r\nm=audio 16952 RTP/SAVPF 9\r\na=rtpmap:9 G722/8000\r\na=silenceSupp:off - - - -\r\na=ptime:20\r\na=sendrecv\r\na=mid:0\r\na=fingerprint:sha-256 45:57:25:EC:5D:91:D9:DD:B0:63:16:19:96:35:69:74:50:10:D4:0F:AF:7C:4A:48:10:B5:0C:9E:D8:81:62:28\r\na=setup:actpass\r\na=rtcp-mux\r\na=rtcp:16952 IN IP4 185.246.41.194\r\na=ice-ufrag:Ve8HU3HAZpKuww8t\r\na=ice-pwd:U8R0EsQEEyI3gtfTkw5dLsu4\r\na=candidate:3068080591 1 udp 2130706431 185.246.41.194 16952 typ host generation 0\r\na=candidate:3068080591 2 udp 2130706430 185.246.41.194 16952 typ host generation 0\r\na=end-of-candidates\r\na=ssrc:3699583393 cname:K2HknTRZl1p68VPF\r\na=ssrc:3699583393 msid:GHVvLj3nPKycSfBNZBXwExoFdYHAQ2AQ a0\r\na=ssrc:3699583393 mslabel:GHVvLj3nPKycSfBNZBXwExoFdYHAQ2AQ\r\na=ssrc:3699583393 label:GHVvLj3nPKycSfBNZBXwExoFdYHAQ2AQa0\r\n",
//     telnyx_leg_id: "9fcae98e-686d-11f0-8284-02420a0ddb20",
//     telnyx_session_id: "9fc46906-686d-11f0-9240-02420a0ddb20",
//     variables: {
//       "Core-UUID": "415d6f84-428f-46f7-ac2e-1d1e79673c89",
//       "Event-Calling-File": "switch_channel.c",
//       "Event-Calling-Function": "switch_channel_get_variables_prefix",
//       "Event-Calling-Line-Number": "4642",
//       "Event-Date-GMT": "Thu, 24 Jul 2025 09:08:05 GMT",
//       "Event-Date-Local": "2025-07-24 09:08:05",
//       "Event-Date-Timestamp": "1753348085735317",
//       "Event-Name": "CHANNEL_DATA",
//       "Event-Sequence": "8660473",
//     },
//   },
//   voice_sdk_id: "VSDK1Ch8RUTpauq8R_PjeRii_E_pLMAph9Q",
// };

export type AttachEvent = {
  id: number;
  jsonrpc: '2.0';
  method: 'telnyx_rtc.attach';
  params: {
    callID: string;
    callee_id_name: string;
    callee_id_number: string;
    caller_id_name: string;
    caller_id_number: string;
    dialogParams: {
      custom_headers: Array<{ name: string; value: string }>;
    };
    display_direction: 'inbound' | 'outbound';
    sdp: string;
    telnyx_leg_id: string;
    telnyx_session_id: string;
    variables?: Record<string, string>;
  };
};

export function isAttachEvent(msg: unknown): msg is AttachEvent {
  if (!msg || typeof msg !== 'object') {
    return false;
  }
  const tmp = msg as Partial<AttachEvent>;
  return tmp.method === 'telnyx_rtc.attach' && !!tmp.params?.callID;
}

export function createAttachCallMessage(pushNotificationPayload?: any) {
  const message = {
    jsonrpc: '2.0' as const,
    id: Math.floor(Math.random() * 1000000),
    method: 'telnyx_rtc.attachCalls' as const,
    params: {} as Record<string, any>,
  };

  // Add push notification metadata if available
  if (pushNotificationPayload) {
    console.log('[AttachMessage] Creating attach message with payload:', pushNotificationPayload);

    // The payload structure might be nested - check both levels
    const metadata = pushNotificationPayload.metadata || pushNotificationPayload;

    // If payload has voice_sdk_id, include it (this should match the WebSocket connection voice_sdk_id)
    if (metadata.voice_sdk_id) {
      message.params.voice_sdk_id = metadata.voice_sdk_id;
      console.log('[AttachMessage] Added voice_sdk_id:', metadata.voice_sdk_id);
    }

    // Add any other relevant push metadata
    if (metadata.call_id) {
      message.params.callID = metadata.call_id;
      console.log('[AttachMessage] Added callID:', metadata.call_id);
    }

    if (metadata.telnyx_session_id) {
      message.params.telnyx_session_id = metadata.telnyx_session_id;
      console.log('[AttachMessage] Added telnyx_session_id:', metadata.telnyx_session_id);
    }

    if (metadata.telnyx_leg_id) {
      message.params.telnyx_leg_id = metadata.telnyx_leg_id;
      console.log('[AttachMessage] Added telnyx_leg_id:', metadata.telnyx_leg_id);
    }

    // Add push notification provider info
    message.params.push_notification_provider = Platform.OS;
    message.params.push_notification_environment = __DEV__ ? 'debug' : 'production';

    console.log('[AttachMessage] Final attach message:', message);
  }

  return message;
}
