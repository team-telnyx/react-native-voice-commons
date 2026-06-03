import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Phone, PhoneOff } from 'lucide-react-native';
import { Call } from '../react-voice-commons-sdk/src';
import { demoColors, radii, sizes, spacing } from './demoTheme';

type Props = {
  call: Call;
  isPushNotificationCall?: boolean;
};

export function RingingCall({ call, isPushNotificationCall = false }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
  }, [call]);

  if (isPushNotificationCall || !visible) {
    return null;
  }

  const handleReject = async () => {
    try {
      await call.hangup();
      setVisible(false);
    } catch (error) {
      showCallActionError('Reject Failed', error);
    }
  };

  const handleAnswer = async () => {
    try {
      await call.answer();
      setVisible(false);
    } catch (error) {
      showCallActionError('Answer Failed', error);
    }
  };

  return (
    <View style={styles.overlay} testID="incomingCallView">
      <View style={styles.content}>
        <Text style={styles.stateLabel}>{call.isIncoming ? 'Incoming Call' : 'Ringing'}</Text>
        <Text style={styles.callerName}>{call.callerName || call.destination}</Text>
        <Text style={styles.callerNumber}>{call.callerNumber || call.destination}</Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={handleReject}
            testID="callReject"
            accessibilityLabel="Reject"
          >
            <PhoneOff size={24} color={demoColors.text} />
          </TouchableOpacity>

          {call.isIncoming && (
            <TouchableOpacity
              style={[styles.actionButton, styles.answerButton]}
              onPress={handleAnswer}
              testID="callAnswer"
              accessibilityLabel="Answer"
            >
              <Phone size={24} color={demoColors.text} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    backgroundColor: demoColors.background,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  content: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  stateLabel: {
    color: demoColors.mutedText,
    fontSize: 16,
  },
  callerName: {
    color: demoColors.text,
    fontSize: 24,
    fontWeight: '500',
    textAlign: 'center',
  },
  callerNumber: {
    color: demoColors.mutedText,
    fontSize: 16,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxl,
    marginTop: spacing.xl,
  },
  actionButton: {
    width: sizes.callButton,
    height: sizes.callButton,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButton: {
    backgroundColor: demoColors.danger,
  },
  answerButton: {
    backgroundColor: demoColors.telnyxGreen,
  },
});

function showCallActionError(title: string, error: unknown) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  Alert.alert(title, errorMessage);
}
