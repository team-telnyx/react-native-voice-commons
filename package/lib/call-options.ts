import type { MediaTrackConstraints } from 'react-native-webrtc/lib/typescript/Constraints';
import { MediaStream } from 'react-native-webrtc';

export interface CallOptions {
  /**
   * The destination for the call.
   * This can be a phone number, SIP URI, or any other valid Telnyx destination.
   */
  destinationNumber?: string;

  /**
   * WebRTC audio constraints for the call.
   * This can be a boolean to enable/disable audio or an object with specific constraints.
   * @default true
   * @see https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints
   * @example
   * ```typescript
   * {
   *   audio: {
   *     echoCancellation: true,
   *     noiseSuppression: true,
   *     autoGainControl: true,
   *   },
   * }
   * ```
   * @example
   * ```typescript
   * {
   *   audio: true, // Enable audio with default constraints
   * }
   * ```
   */
  audio?: boolean | MediaTrackConstraints;
  /**
   * The caller ID name to display for the call.
   */
  callerIdName?: string;
  /**
   * The caller ID number to display for the call.
   */
  callerIdNumber?: string;
  /**
   * Custom headers to include in the call request.
   * This can be used to pass additional information or metadata with the call.
   * Each header should be an object with `name` and `value` properties.
   * @example
   * ```typescript
   * [
   *   { name: 'X-Custom-Header', value: 'CustomValue' },
   *   { name: 'X-Another-Header', value: 'AnotherValue' },
   * ]
   * ```
   */
  customHeaders?: { name: string; value: string }[];
  /**
   * Client state to persist across calls.
   * This can be used to store any custom state information that should be maintained.
   * This is typically specified as base64 encoded string.
   * @example
   * ```typescript
   * btoa(JSON.stringify({ key: 'value' }))
   * ```
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/btoa
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/atob
   *
   */
  clientState?: string;
  /**
   * optional MediaStream for the local audio  tracks.
   */
  localStream?: MediaStream;
  /**
   * optional MediaStream for the remote audio tracks.
   * This is typically used to play the remote audio stream in the application.
   */
  remoteStream?: MediaStream;
  /**
   * Peer connection options for the WebRTC call.
   * These options can be used to customize the behavior of the WebRTC peer connection.
   * For example, you can specify ICE servers, transport policies, and more.
   */
  peerConnectionOptions?: {
    prefetchIceCandidates?: boolean;
    /**
     * The ICE servers to use for the WebRTC connection.
     * This can include STUN and TURN servers.
     * @example
     * ```typescript
     * [
     *   { urls: 'stun:stun.l.google.com:19302' },
     *   { urls: 'turn:turn.example.com', username: 'user', credential: 'password' },
     * ]
     * ```
     */
    iceServers?: RTCIceServer[];
    /**
     * The ICE transport policy to use for the WebRTC connection.
     * This can be 'all', 'relay', 'nohost', or 'none'.
     * @default 'all'
     */
    iceTransportPolicy?: RTCIceTransportPolicy;
    /**
     * The bundle policy to use for the WebRTC connection.
     * This can be 'balanced', 'max-compat', or 'max-bundle'.
     * @default 'balanced'
     */
    bundlePolicy?: RTCBundlePolicy;
    /**
     * The RTCP mux policy to use for the WebRTC connection.
     * This can be 'require' or 'negotiate'.
     * @default 'require'
     */
    rtcpMuxPolicy?: RTCRtcpMuxPolicy;
  };
  remoteCallerIdName?: string;
  remoteCallerIdNumber?: string;
}
