import React, { createContext, useContext } from 'react';
import { TelnyxVoipClient } from '../telnyx-voip-client';
import { TelnyxConnectionState } from '../models/connection-state';

interface TelnyxVoiceContextValue {
  voipClient: TelnyxVoipClient;
  // Add methods that CallKitHandler expects (these can be no-ops for now)
  connectionState?: TelnyxConnectionState;
  setConnectionState?: (state: TelnyxConnectionState) => void;
  connect?: (payload: any) => Promise<any>;
  client?: any;
  setClient?: (client: any) => void;
  enableAutoReconnect?: (enabled: boolean) => void;
}

const TelnyxVoiceContext = createContext<TelnyxVoiceContextValue | null>(null);

export const TelnyxVoiceProvider: React.FC<{
  voipClient: TelnyxVoipClient;
  children: React.ReactNode;
}> = ({ voipClient, children }) => {
  return (
    <TelnyxVoiceContext.Provider value={{ voipClient }}>{children}</TelnyxVoiceContext.Provider>
  );
};

export const useTelnyxVoice = (): TelnyxVoiceContextValue => {
  const context = useContext(TelnyxVoiceContext);
  if (!context) {
    throw new Error('useTelnyxVoice must be used within a TelnyxVoiceProvider');
  }
  return context;
};
