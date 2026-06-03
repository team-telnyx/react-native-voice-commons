import React, { useEffect, useState } from 'react';
import {
  Alert,
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
import { LogOut, Phone } from 'lucide-react-native';
import { useTelnyxVoice, TelnyxConnectionState } from '../react-voice-commons-sdk/src';
import { demoColors, radii, sizes, spacing } from './demoTheme';

interface TelnyxDialerProps {
  debug?: boolean;
}

type DestinationType = 'sip' | 'phone';

export const TelnyxDialer: React.FC<TelnyxDialerProps> = ({ debug = false }) => {
  const { voipClient } = useTelnyxVoice();
  const [destinationType, setDestinationType] = useState<DestinationType>('sip');
  const [destinationNumber, setDestinationNumber] = useState('');
  const [callerIdName, setCallerIdName] = useState('');
  const [callerIdNumber, setCallerIdNumber] = useState('');
  const [connectionState, setConnectionState] = useState(voipClient.currentConnectionState);
  const [inputFocused, setInputFocused] = useState(false);

  const log = debug ? console.log : () => {};
  const isConnected = connectionState === TelnyxConnectionState.CONNECTED;

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
      log('TelnyxDialer: Starting call to:', destinationNumber);
      await voipClient.newCall(
        destinationNumber.trim(),
        callerIdName.trim() || undefined,
        callerIdNumber.trim() || undefined
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      log('TelnyxDialer: Error starting call:', errorMessage);
      Alert.alert('Call Failed', `Failed to start call: ${errorMessage}`);
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
          <View>
            <Text style={styles.title}>Telnyx Mobile WebRTC</Text>
            <TouchableOpacity onLongPress={handleDisablePushNotifications} delayLongPress={2000}>
              <Text
                style={[
                  styles.socketStatus,
                  isConnected && styles.socketReady,
                  connectionState === TelnyxConnectionState.CONNECTING && styles.socketPending,
                  connectionState === TelnyxConnectionState.DISCONNECTED && styles.socketOffline,
                ]}
                testID="socketStatus"
              >
                Socket: {isConnected ? 'Client-ready' : connectionState}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={handleDisconnect}
            testID="disconnectButton"
            accessibilityLabel="Disconnect"
          >
            <LogOut size={22} color={demoColors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.profileBar}>
          <View>
            <Text style={styles.profileLabel}>Caller name</Text>
            <Text style={styles.profileValue}>{callerIdName || 'Unknown'}</Text>
          </View>
          <View style={styles.profileDivider} />
          <View>
            <Text style={styles.profileLabel}>Caller number</Text>
            <Text style={styles.profileValue}>{callerIdNumber || '-'}</Text>
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
          testID="callInput"
          accessibilityLabel="Call input"
        />

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.callButton, !isConnected && styles.buttonDisabled]}
            onPress={handleStartCall}
            disabled={!isConnected}
            testID="call"
            accessibilityLabel="Call"
          >
            <Phone size={24} color={demoColors.text} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

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
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  title: {
    color: demoColors.text,
    fontSize: 24,
    fontWeight: '500',
  },
  socketStatus: {
    color: demoColors.mutedText,
    fontSize: 14,
    marginTop: 4,
  },
  socketReady: {
    color: demoColors.selectedGreen,
  },
  socketPending: {
    color: demoColors.ringing,
  },
  socketOffline: {
    color: demoColors.danger,
  },
  headerIconButton: {
    width: sizes.callButton,
    height: sizes.callButton,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: demoColors.secondary,
  },
  profileBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: demoColors.secondary,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.sm,
    backgroundColor: demoColors.secondarySurface,
  },
  profileLabel: {
    color: demoColors.mutedText,
    fontSize: 14,
  },
  profileValue: {
    color: demoColors.text,
    fontSize: 16,
    fontWeight: '500',
    marginTop: 2,
  },
  profileDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: demoColors.secondary,
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
  callButton: {
    width: sizes.callButton,
    height: sizes.callButton,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: demoColors.telnyxGreen,
  },
  buttonDisabled: {
    backgroundColor: demoColors.disabled,
  },
});
