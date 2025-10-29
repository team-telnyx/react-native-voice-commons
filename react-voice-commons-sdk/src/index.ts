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

// Main client
export {
  TelnyxVoipClient,
  createTelnyxVoipClient,
  createBackgroundTelnyxVoipClient,
} from './telnyx-voip-client';
export type { TelnyxVoipClientOptions } from './telnyx-voip-client';

// TelnyxVoiceApp component
export { TelnyxVoiceApp } from './telnyx-voice-app';
export type { TelnyxVoiceAppOptions, TelnyxVoiceAppProps } from './telnyx-voice-app';

// Hooks
export { useAppStateHandler } from './hooks/useAppStateHandler';
export { useTelnyxVoice } from './context/TelnyxVoiceContext';

// Models
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

// Re-export useful types from the underlying SDK
export type { Call as TelnyxCall } from '@telnyx/react-native-voice-sdk';

// Export CallKit functionality
export * from './callkit';

// Export hooks
export { useAppReadyNotifier } from './hooks/useAppReadyNotifier';
