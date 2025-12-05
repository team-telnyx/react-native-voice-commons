import { AppStateStatus } from 'react-native';
import { TelnyxVoipClient } from '../telnyx-voip-client';
interface UseAppStateHandlerOptions {
  voipClient: TelnyxVoipClient;
  disconnectOnBackground?: boolean;
  navigateToLoginOnDisconnect?: boolean;
  debug?: boolean;
}
/**
 * Hook to handle app state changes for VoIP behavior
 * When app goes to background without an active call, disconnect socket and redirect to login
 */
export declare const useAppStateHandler: ({
  voipClient,
  disconnectOnBackground,
  navigateToLoginOnDisconnect,
  debug,
}: UseAppStateHandlerOptions) => {
  currentAppState: AppStateStatus;
};
export {};
