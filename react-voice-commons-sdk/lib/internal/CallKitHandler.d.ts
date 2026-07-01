import React from 'react';
interface CallKitHandlerProps {
  /** Callback when user needs to login from push notification */
  onLoginRequired?: (pushPayload: any) => void;
  /** Callback when call is answered and user should navigate to dialer */
  onNavigateToDialer?: () => void;
  /** Callback when call ends and user should navigate back */
  onNavigateBack?: () => void;
}
/**
 * Internal CallKit handler for iOS push notifications
 * This component is automatically included in TelnyxVoiceApp
 *
 * The active instance removes only its own DeviceEventEmitter subscriptions on
 * unmount via each listener's `.remove()` method.
 *
 * @internal - Users should not use this component directly
 */
export declare const CallKitHandler: React.FC<CallKitHandlerProps>;
export {};
