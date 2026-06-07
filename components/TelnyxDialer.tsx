import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MoreVertical, Phone } from 'lucide-react-native';
import {
  Call,
  useTelnyxVoice,
  TelnyxConnectionState,
  TelnyxCallState,
} from '../react-voice-commons-sdk/src';
import { demoColors, radii, sizes, spacing } from './demoTheme';
import { InlineCallControls } from './InlineCallControls';

interface TelnyxDialerProps {
  debug?: boolean;
}

type DestinationType = 'sip' | 'phone';
const telnyxLogo = require('../assets/images/telnyx_logo.png');

export const TelnyxDialer: React.FC<TelnyxDialerProps> = ({ debug = false }) => {
  const { voipClient } = useTelnyxVoice();
  const [destinationType, setDestinationType] = useState<DestinationType>('sip');
  const [destinationNumber, setDestinationNumber] = useState('');
  const [callerIdName, setCallerIdName] = useState('');
  const [callerIdNumber, setCallerIdNumber] = useState('');
  const [connectionState, setConnectionState] = useState(voipClient.currentConnectionState);
  const [activeCall, setActiveCall] = useState<Call | null>(voipClient.currentActiveCall);
  const [activeCallState, setActiveCallState] = useState<TelnyxCallState | null>(
    voipClient.currentActiveCall?.currentState || null
  );
  const [inputFocused, setInputFocused] = useState(false);
  const [isStartingCall, setIsStartingCall] = useState(false);

  const log = debug ? console.log : () => {};
  const isConnected = connectionState === TelnyxConnectionState.CONNECTED;
  const sessionId = isConnected ? voipClient.sessionId || '-' : '-';

  useEffect(() => {
    const connectionSubscription = voipClient.connectionState$.subscribe((state) => {
      log('TelnyxDialer: Connection state changed to:', state);
      setConnectionState(state);

      if (state === TelnyxConnectionState.DISCONNECTED || state === TelnyxConnectionState.ERROR) {
        router.replace('/');
      }
    });

    loadProfile();
    return () => connectionSubscription.unsubscribe();
  }, [voipClient, log]);

  useEffect(() => {
    const activeCallSubscription = voipClient.activeCall$.subscribe((call) => {
      setActiveCall(call);
    });

    return () => activeCallSubscription.unsubscribe();
  }, [voipClient]);

  useEffect(() => {
    if (!activeCall) {
      setActiveCallState(null);
      return;
    }

    const callStateSubscription = activeCall.callState$.subscribe(setActiveCallState);
    return () => callStateSubscription.unsubscribe();
  }, [activeCall]);

  const loadProfile = async () => {
    try {
      const [storedCallerIdName, storedCallerIdNumber] = await Promise.all([
        AsyncStorage.getItem('@caller_id_name'),
        AsyncStorage.getItem('@caller_id_number'),
      ]);

      setCallerIdName(storedCallerIdName || '');
      setCallerIdNumber(storedCallerIdNumber || '');
    } catch (error) {
      log('TelnyxDialer: Failed to load caller ID profile:', error);
    }
  };

  const handleStartCall = async () => {
    if (!destinationNumber.trim()) {
      Alert.alert('Error', 'Enter a destination to initiate your call.');
      return;
    }

    if (!isConnected) {
      Alert.alert('Error', 'Not connected to Telnyx service');
      return;
    }

    try {
      setIsStartingCall(true);
      log('TelnyxDialer: Starting call to:', destinationNumber);
      await voipClient.newCall(
        destinationNumber.trim(),
        callerIdName.trim() || undefined,
        callerIdNumber.trim() || undefined
      );
      setIsStartingCall(false);
    } catch (error) {
      setIsStartingCall(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      log('TelnyxDialer: Error starting call:', errorMessage);
      Alert.alert('Call Failed', `Failed to start call: ${errorMessage}`);
    }
  };

  const handleEndCall = async () => {
    if (!activeCall) {
      setIsStartingCall(false);
      return;
    }

    try {
      await activeCall.hangup();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      log('TelnyxDialer: Error ending call:', errorMessage);
      Alert.alert('End Call Failed', errorMessage);
    } finally {
      setIsStartingCall(false);
    }
  };

  const handleAnswerCall = async () => {
    if (!activeCall) return;

    try {
      await activeCall.answer();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      log('TelnyxDialer: Error answering call:', errorMessage);
      Alert.alert('Answer Call Failed', errorMessage);
    }
  };

  const handleDisablePushNotifications = () => {
    try {
      voipClient.disablePushNotifications();
      Alert.alert('Push Notifications', 'Push notifications disabled for this session');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Error', `Failed to disable push notifications: ${errorMessage}`);
    }
  };

  const handleDisconnect = async () => {
    try {
      await voipClient.logout();
      router.replace('/');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Disconnect Failed', errorMessage);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <View style={styles.topSpacer} />
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => Alert.alert('Menu', 'Websocket Messages')}
            onLongPress={handleDisablePushNotifications}
            delayLongPress={2000}
            testID="menuButton"
            accessibilityLabel="Menu"
          >
            <MoreVertical size={22} color={demoColors.text} />
          </TouchableOpacity>
        </View>

        <Image
          source={telnyxLogo}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Telnyx WebRTC"
        />

        <Text style={styles.instructions}>
          Enter a destination (phone number or SIP user) to initiate your call.
        </Text>

        <View style={styles.stateStack}>
          <StateRow
            label="Socket"
            value={isConnected ? 'Client-ready' : connectionState}
            dotColor={socketStateColor(connectionState)}
            testID="socketStatus"
          />
          <StateRow
            label="Call State"
            value={callStateLabel(activeCallState)}
            dotColor={callStateColor(activeCallState)}
          />
          <View style={styles.stateSection}>
            <Text style={styles.stateLabel}>Session ID</Text>
            <Text style={styles.stateValue}>{sessionId}</Text>
          </View>
        </View>

        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segment, destinationType === 'sip' && styles.segmentSelected]}
            onPress={() => setDestinationType('sip')}
            disabled={!isConnected}
            testID="sipAddressToggle"
            accessibilityLabel="SIP address"
          >
            <Text
              style={[styles.segmentText, destinationType === 'sip' && styles.segmentTextSelected]}
            >
              SIP address
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, destinationType === 'phone' && styles.segmentSelected]}
            onPress={() => setDestinationType('phone')}
            disabled={!isConnected}
            testID="phoneNumberToggle"
            accessibilityLabel="Phone number"
          >
            <Text
              style={[
                styles.segmentText,
                destinationType === 'phone' && styles.segmentTextSelected,
              ]}
            >
              Phone number
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={[styles.callInput, inputFocused && styles.inputFocused]}
          placeholder={destinationType === 'phone' ? 'Enter phone number' : 'Enter SIP address'}
          placeholderTextColor="gray"
          value={destinationNumber}
          onChangeText={setDestinationNumber}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          keyboardType={destinationType === 'phone' ? 'phone-pad' : 'default'}
          autoCapitalize="none"
          autoCorrect={false}
          editable={isConnected}
          testID="numberToCallTextField"
          accessibilityLabel="Call input"
        />

        <View style={styles.actions}>
          {isStartingCall || activeCall ? (
            <InlineCallControls
              activeCall={activeCall}
              activeCallState={activeCallState}
              destination={destinationNumber}
              isStartingCall={isStartingCall}
              onAnswer={handleAnswerCall}
              onEnd={handleEndCall}
            />
          ) : (
            <TouchableOpacity
              style={[styles.callButton, !isConnected && styles.buttonDisabled]}
              onPress={handleStartCall}
              disabled={!isConnected}
              testID="callButton"
              accessibilityRole="button"
              accessibilityLabel="Call"
              activeOpacity={0.75}
            >
              <Phone size={20} color={demoColors.text} pointerEvents="none" />
              <Text style={styles.callButtonText}>Call</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.disconnectButton}
            onPress={handleDisconnect}
            testID="disconnectButton"
            accessibilityLabel="Disconnect"
          >
            <Text style={styles.disconnectButtonText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

type StateRowProps = {
  label: string;
  value: string;
  dotColor: string;
  testID?: string;
};

function StateRow({ label, value, dotColor, testID }: StateRowProps) {
  return (
    <View style={styles.stateSection} testID={testID}>
      <Text style={styles.stateLabel}>{label}</Text>
      <View style={styles.stateValueRow}>
        <View style={[styles.stateDot, { backgroundColor: dotColor }]} />
        <Text style={styles.stateValue}>{value}</Text>
      </View>
    </View>
  );
}

function socketStateColor(connectionState: TelnyxConnectionState) {
  if (connectionState === TelnyxConnectionState.CONNECTED) return demoColors.telnyxGreen;
  if (connectionState === TelnyxConnectionState.CONNECTING) return demoColors.ringing;
  return demoColors.danger;
}

function callStateLabel(callState: TelnyxCallState | null) {
  switch (callState) {
    case TelnyxCallState.RINGING:
      return 'Ringing';
    case TelnyxCallState.CONNECTING:
      return 'Connecting';
    case TelnyxCallState.ACTIVE:
      return 'Active';
    case TelnyxCallState.HELD:
      return 'Held';
    case TelnyxCallState.DROPPED:
      return 'Dropped';
    case TelnyxCallState.FAILED:
      return 'Error';
    case TelnyxCallState.ENDED:
    default:
      return 'Done';
  }
}

function callStateColor(callState: TelnyxCallState | null) {
  switch (callState) {
    case TelnyxCallState.RINGING:
      return demoColors.ringing;
    case TelnyxCallState.CONNECTING:
    case TelnyxCallState.ACTIVE:
    case TelnyxCallState.HELD:
      return demoColors.selectedGreen;
    case TelnyxCallState.DROPPED:
    case TelnyxCallState.FAILED:
      return demoColors.danger;
    case TelnyxCallState.ENDED:
    default:
      return demoColors.disabled;
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: demoColors.background,
  },
  container: {
    flex: 1,
    backgroundColor: demoColors.background,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 64,
    paddingTop: spacing.xs,
  },
  topSpacer: {
    flex: 1,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: demoColors.white,
    shadowColor: demoColors.text,
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  logo: {
    width: 200,
    height: 92,
    alignSelf: 'center',
  },
  instructions: {
    color: demoColors.text,
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  stateStack: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  stateSection: {
    gap: 5,
  },
  stateLabel: {
    color: demoColors.mutedText,
    fontSize: 18,
  },
  stateValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stateValue: {
    color: demoColors.text,
    fontSize: 15,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: demoColors.outline,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    minHeight: sizes.toggleHeight,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: demoColors.white,
  },
  segmentSelected: {
    backgroundColor: demoColors.selectedGreen,
  },
  segmentText: {
    color: demoColors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  segmentTextSelected: {
    color: demoColors.white,
  },
  callInput: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: demoColors.inputOutline,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    color: demoColors.text,
    fontSize: 16,
    backgroundColor: demoColors.background,
  },
  inputFocused: {
    borderColor: demoColors.selectedGreen,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  bottomBar: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingTop: spacing.xl,
  },
  disconnectButton: {
    alignSelf: 'center',
    minWidth: 220,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: demoColors.text,
    paddingHorizontal: spacing.lg,
  },
  disconnectButtonText: {
    color: demoColors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  callButton: {
    minWidth: 112,
    height: sizes.callButton,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: demoColors.telnyxGreen,
  },
  callButtonText: {
    color: demoColors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    backgroundColor: demoColors.disabled,
  },
});
