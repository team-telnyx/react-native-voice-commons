import React, { useState, useEffect } from 'react';
import {
  useTelnyxVoice,
  Call,
  TelnyxCallState,
  useCallKitCoordinator,
} from '../react-voice-commons-sdk/src';
import CurrentCall from './CurrentCall';

interface CallManagerProps {
  debug?: boolean;
}

export const CallManager: React.FC<CallManagerProps> = ({ debug = false }) => {
  const { voipClient } = useTelnyxVoice();
  const { setVoipClient } = useCallKitCoordinator();
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [activeCallState, setActiveCallState] = useState<TelnyxCallState | null>(null);

  const log = debug ? console.log : () => {};

  useEffect(() => {
    log('CallManager: Setting up subscriptions');

    // Set the VoIP client reference in the CallKit coordinator
    if (voipClient) {
      setVoipClient(voipClient);
      log('CallManager: Set VoIP client reference in CallKit coordinator');
    }

    // Subscribe to active call changes
    const activeCallSubscription = voipClient.activeCall$.subscribe((call) => {
      log(
        'CallManager: Active call changed:',
        call
          ? {
              callId: call.callId,
              destination: call.destination,
              isIncoming: call.isIncoming,
              currentState: call.currentState,
            }
          : null
      );

      setActiveCall(call);

      // Immediately set the state if we have a call
      if (call) {
        setActiveCallState(call.currentState);
        log('CallManager: Set initial call state to:', call.currentState);
      } else {
        setActiveCallState(null);
        log('CallManager: Cleared call state (no active call)');
      }
    });

    // Subscribe to all calls changes for debugging
    const callsSubscription = voipClient.calls$.subscribe((calls) => {
      log(
        'CallManager: All calls changed:',
        calls.length,
        calls.map((c) => ({
          callId: c.callId,
          state: c.currentState,
          destination: c.destination,
        }))
      );
    });

    // If there's already an active call, set it
    const currentActiveCall = voipClient.currentActiveCall;
    if (currentActiveCall) {
      log('CallManager: Found existing active call:', {
        callId: currentActiveCall.callId,
        state: currentActiveCall.currentState,
        destination: currentActiveCall.destination,
      });
      setActiveCall(currentActiveCall);
      setActiveCallState(currentActiveCall.currentState);
    }

    return () => {
      log('CallManager: Cleaning up subscriptions');
      activeCallSubscription.unsubscribe();
      callsSubscription.unsubscribe();
    };
  }, [voipClient, setVoipClient, log]);

  // Subscribe to active call state changes when activeCall changes
  useEffect(() => {
    if (!activeCall) {
      log('CallManager: No active call, clearing state subscription');
      setActiveCallState(null);
      return;
    }

    log('CallManager: Setting up call state subscription for call:', activeCall.callId);

    const callStateSubscription = activeCall.callState$.subscribe((state) => {
      log('CallManager: Call state changed to:', state);
      setActiveCallState(state);
    });

    return () => {
      log('CallManager: Cleaning up call state subscription');
      callStateSubscription.unsubscribe();
    };
  }, [activeCall, log]);

  // Log current state for debugging
  useEffect(() => {
    log('CallManager: Current state -', {
      hasActiveCall: !!activeCall,
      activeCallState,
      shouldShowUI: !!(activeCall && activeCallState),
    });
  }, [activeCall, activeCallState, log]);

  // Render the current call screen if there's an active call
  log('CallManager: Rendering -', {
    call: activeCall ? activeCall.callId : null,
    callState: activeCallState,
  });

  return <CurrentCall call={activeCall} callState={activeCallState} />;
};
