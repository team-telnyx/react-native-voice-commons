import React, { useState, useEffect } from 'react';
import { Call, TelnyxCallState } from '../react-voice-commons-sdk/src';
import { RTCView } from 'react-native-webrtc';
import { CallModal } from '~/components/CallModal';

type Props = {
  call: Call;
};

export function ActiveCall({ call }: Props) {
  const [isOpen, setIsOpen] = useState(true);

  console.log('ActiveCall: Rendering with call:', {
    callId: call.callId,
    destination: call.destination,
    isIncoming: call.isIncoming,
    currentState: call.currentState,
  });

  // Ensure dialog stays open when call is active/held and closed when ended
  useEffect(() => {
    if (call) {
      if (
        call.currentState === TelnyxCallState.ACTIVE ||
        call.currentState === TelnyxCallState.HELD
      ) {
        setIsOpen(true);
        console.log(
          'ActiveCall: Setting dialog open for active/held call, state:',
          call.currentState
        );
      } else if (
        call.currentState === TelnyxCallState.ENDED ||
        call.currentState === TelnyxCallState.FAILED
      ) {
        setIsOpen(false);
        console.log(
          'ActiveCall: Setting dialog closed for ended/failed call, state:',
          call.currentState
        );
      }
    }
  }, [call, call?.currentState]);

  const handleHangup = () => {
    console.log('ActiveCall: Hanging up call');
    call.hangup();
    // Close modal immediately on hangup to prevent invisible overlay
    setIsOpen(false);
  };

  const handleHold = () => {
    if (call.currentState === TelnyxCallState.HELD) {
      console.log('ActiveCall: Resuming call from hold');
      call.resume();
    } else {
      console.log('ActiveCall: Putting call on hold');
      call.hold();
    }
  };

  // Only render if we have an active or held call
  if (
    !call ||
    (call.currentState !== TelnyxCallState.ACTIVE && call.currentState !== TelnyxCallState.HELD)
  ) {
    console.log('ActiveCall: Not rendering - call not active/held:', {
      hasCall: !!call,
      currentState: call?.currentState,
    });
    return null;
  }

  const isOnHold = call.currentState === TelnyxCallState.HELD;

  return (
    <CallModal
      visible={isOpen}
      title={isOnHold ? 'Call is on hold' : 'Call is active'}
      description={`${call.isIncoming ? 'Incoming' : 'Outgoing'}: ${call.destination}`}
      buttons={[
        {
          text: 'Hangup',
          onPress: handleHangup,
          variant: 'danger',
        },
        {
          text: isOnHold ? 'Resume' : 'Hold',
          onPress: handleHold,
          variant: 'secondary',
        },
      ]}
      onRequestClose={() => {}}
    />
  );
}
