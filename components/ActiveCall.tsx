import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Call, TelnyxCallState } from '../react-voice-commons-sdk/src';
import { RTCView } from 'react-native-webrtc';
import { CallModal } from '~/components/CallModal';
import { Text } from '~/components/ui/text';

type Props = {
  call: Call;
};

const DTMF_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

export function ActiveCall({ call }: Props) {
  const [isOpen, setIsOpen] = useState(true);
  const [dtmfLog, setDtmfLog] = useState('');

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
    try {
      call.hangup();
    } catch (error) {
      console.log('ActiveCall: Error hanging up call:', error);
    }
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

  const handleDtmf = (digit: string) => {
    console.log(`ActiveCall: Sending DTMF "${digit}"`);
    call
      .dtmf(digit)
      .then(() => setDtmfLog((prev) => (prev + digit).slice(-20)))
      .catch((err) => console.log('ActiveCall: DTMF error:', err));
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
  const canDtmf = call.currentState === TelnyxCallState.ACTIVE;

  const dialpad = (
    <View>
      <Text
        style={{
          fontSize: 12,
          color: '#6b7280',
          marginBottom: 6,
          textAlign: 'center',
        }}
      >
        DTMF test pad {canDtmf ? '' : '(inactive)'}
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: '#111827',
          textAlign: 'center',
          marginBottom: 8,
          minHeight: 18,
          letterSpacing: 2,
          fontFamily: 'Courier',
        }}
      >
        {dtmfLog || ' '}
      </Text>
      {DTMF_KEYS.map((row, rowIdx) => (
        <View
          key={rowIdx}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          {row.map((digit) => (
            <TouchableOpacity
              key={digit}
              disabled={!canDtmf}
              onPress={() => handleDtmf(digit)}
              style={{
                flex: 1,
                marginHorizontal: 3,
                paddingVertical: 10,
                borderRadius: 6,
                backgroundColor: canDtmf ? '#e5e7eb' : '#f3f4f6',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '600',
                  color: canDtmf ? '#111827' : '#9ca3af',
                }}
              >
                {digit}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );

  return (
    <CallModal
      visible={isOpen}
      title={isOnHold ? 'Call is on hold' : 'Call is active'}
      description={`${call.isIncoming ? 'Incoming' : 'Outgoing'}: ${call.destination}`}
      extraContent={dialpad}
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
