import React from 'react';
import { TelnyxVoipClient } from '../telnyx-voip-client';
import { TelnyxConnectionState } from '../models/connection-state';
interface TelnyxVoiceContextValue {
  voipClient: TelnyxVoipClient;
  connectionState?: TelnyxConnectionState;
  setConnectionState?: (state: TelnyxConnectionState) => void;
  connect?: (payload: any) => Promise<any>;
  client?: any;
  setClient?: (client: any) => void;
  enableAutoReconnect?: (enabled: boolean) => void;
}
export declare const TelnyxVoiceProvider: React.FC<{
  voipClient: TelnyxVoipClient;
  children: React.ReactNode;
}>;
export declare const useTelnyxVoice: () => TelnyxVoiceContextValue;
export {};
