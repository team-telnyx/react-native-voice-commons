/**
 * Centralized JSON-RPC method names used for Telnyx WebRTC signaling.
 *
 * All communication with the Telnyx backend uses these method strings
 * in JSON-RPC 2.0 messages sent over the WebSocket connection.
 */
export const TelnyxRTCMethod = {
  INVITE: 'telnyx_rtc.invite',
  ANSWER: 'telnyx_rtc.answer',
  BYE: 'telnyx_rtc.bye',
  RINGING: 'telnyx_rtc.ringing',
  MODIFY: 'telnyx_rtc.modify',
  INFO: 'telnyx_rtc.info',
  MEDIA: 'telnyx_rtc.media',
  PING: 'telnyx_rtc.ping',
  ATTACH: 'telnyx_rtc.attach',
  ATTACH_CALLS: 'telnyx_rtc.attachCalls',
  CLIENT_READY: 'telnyx_rtc.clientReady',
  GATEWAY_STATE: 'telnyx_rtc.gatewayState',
  DISABLE_PUSH_NOTIFICATION: 'telnyx_rtc.disable_push_notification',
} as const;
