import { Call } from '../react-voice-commons-sdk/src';
import { CallModal } from '~/components/CallModal';
import { useState, useEffect } from 'react';

type Props = {
  call: Call;
  isPushNotificationCall?: boolean;
};

export function CallConnecting({ call, isPushNotificationCall = false }: Props) {
  const [isOpen, setIsOpen] = useState(true);

  console.log('CallConnecting: Rendering with call:', {
    callId: call.callId,
    destination: call.destination,
    isIncoming: call.isIncoming,
    currentState: call.currentState,
    isPushNotificationCall,
  });

  // Ensure dialog stays open when call is connecting
  useEffect(() => {
    if (call) {
      setIsOpen(true);
    }
  }, [call]);

  const handleHangup = () => {
    console.log('CallConnecting: Hanging up call');
    call.hangup();
    setIsOpen(false);
  };

  const buttons = [
    {
      text: 'Hangup',
      onPress: handleHangup,
      variant: 'danger' as const,
    },
  ];

  return (
    <CallModal
      visible={isOpen}
      title="Connecting call..."
      description={`Connecting to ${call.destination}...`}
      isLoading={true}
      loadingText={call.destination}
      buttons={buttons}
      onRequestClose={() => {}}
    />
  );
}
