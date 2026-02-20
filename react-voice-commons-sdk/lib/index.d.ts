/**
 * @telnyx/react-voice-commons-sdk
 *
 * A high-level, state-agnostic, drop-in module for the Telnyx React Native SDK.
 *
 * This library provides a simplified interface for integrating Telnyx WebRTC
 * capabilities into React Native applications. It handles session management,
 * call state transitions, push notification processing, and native call UI
 * integration.
 */
export {
  TelnyxVoipClient,
  createTelnyxVoipClient,
  destroyTelnyxVoipClient,
  createBackgroundTelnyxVoipClient,
} from './telnyx-voip-client';
export type { TelnyxVoipClientOptions } from './telnyx-voip-client';
export { TelnyxVoiceApp } from './telnyx-voice-app';
export type { TelnyxVoiceAppOptions, TelnyxVoiceAppProps } from './telnyx-voice-app';
export { useAppStateHandler } from './hooks/useAppStateHandler';
export { useTelnyxVoice } from './context/TelnyxVoiceContext';
export { Call } from './models/call';
export {
  TelnyxConnectionState,
  isTelnyxConnectionState,
  canMakeCalls,
  isConnected,
  isTransitioning,
} from './models/connection-state';
export { TelnyxCallState, isTelnyxCallState, CallStateHelpers } from './models/call-state';
export {
  isCredentialConfig,
  isTokenConfig,
  validateConfig,
  validateCredentialConfig,
  validateTokenConfig,
  createCredentialConfig,
  createTokenConfig,
} from './models/config';
export type { Config, CredentialConfig, TokenConfig } from './models/config';
export type { Call as TelnyxCall } from '@telnyx/react-native-voice-sdk';
export * from './callkit';
export { useAppReadyNotifier } from './hooks/useAppReadyNotifier';
