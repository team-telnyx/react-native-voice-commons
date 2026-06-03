import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PhoneOff } from 'lucide-react-native';
import { Call } from '../react-voice-commons-sdk/src';
import { demoColors, radii, sizes, spacing } from './demoTheme';

type Props = {
  call: Call;
  isPushNotificationCall?: boolean;
  title?: string;
  description?: string;
  loadingText?: string;
};

export function CallConnecting({ call, title = 'Connecting', description, loadingText }: Props) {
  const handleHangup = async () => {
    try {
      await call.hangup();
    } catch (error) {
      showCallActionError('End Call Failed', error);
    }
  };

  return (
    <View style={styles.overlay} testID="callConnectingView">
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.destination}>{loadingText || call.destination}</Text>
        <Text style={styles.description}>
          {description || `Connecting to ${call.destination}...`}
        </Text>
        <ActivityIndicator size="large" color={demoColors.selectedGreen} style={styles.loader} />

        <TouchableOpacity
          style={styles.endButton}
          onPress={handleHangup}
          testID="endCall"
          accessibilityLabel="End"
        >
          <PhoneOff size={24} color={demoColors.white} />
        </TouchableOpacity>
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
  },
  title: {
    color: demoColors.mutedText,
    fontSize: 16,
    marginBottom: spacing.xs,
  },
  destination: {
    color: demoColors.text,
    fontSize: 24,
    fontWeight: '500',
    textAlign: 'center',
  },
  description: {
    color: demoColors.mutedText,
    fontSize: 16,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  loader: {
    marginTop: spacing.lg,
  },
  endButton: {
    width: sizes.callButton,
    height: sizes.callButton,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: demoColors.danger,
    marginTop: spacing.xl,
  },
});

function showCallActionError(title: string, error: unknown) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  Alert.alert(title, errorMessage);
}
