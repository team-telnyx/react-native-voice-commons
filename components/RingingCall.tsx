import { Call } from '../react-voice-commons-sdk/src';
import { CallModal } from '~/components/CallModal';
import { useState, useEffect } from 'react';

type Props = {
  call: Call;
  isPushNotificationCall?: boolean;
};

export function RingingCall({ call, isPushNotificationCall = false }: Props) {
  const [isOpen, setIsOpen] = useState(true);

  console.log('RingingCall: Rendering with call:', {
    callId: call.callId,
    destination: call.destination,
    isIncoming: call.isIncoming,
    currentState: call.currentState,
    isPushNotificationCall,
  });

  // Ensure dialog stays open when call is ringing
  useEffect(() => {
    if (call) {
      setIsOpen(true);
    }
  }, [call]);

  const handleHangup = () => {
    console.log('RingingCall: Hanging up call');
    call.hangup();
    setIsOpen(false);
  };

  const handleAnswer = () => {
    console.log('RingingCall: Answering call');
    call.answer();
    setIsOpen(false);
  };

  const buttons: Array<{
    text: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
  }> = [
    {
      text: 'Hangup',
      onPress: handleHangup,
      variant: 'danger' as const,
    },
  ];

  if (call.isIncoming) {
    buttons.push({
      text: 'Answer',
      onPress: handleAnswer,
      variant: 'primary' as const,
    });
  }

  return (
    <CallModal
      visible={isOpen}
      title="Call is ringing"
      description={`${call.isIncoming ? 'Incoming' : 'Outgoing'}: ${call.destination}`}
      buttons={buttons}
      onRequestClose={() => {}}
    />
  );
}
