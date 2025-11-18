import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTelnyxVoice, TelnyxConnectionState, Call } from '../react-voice-commons-sdk/src';

interface TelnyxDialerProps {
  debug?: boolean;
}

export const TelnyxDialer: React.FC<TelnyxDialerProps> = ({ debug = false }) => {
  const { voipClient } = useTelnyxVoice();
  const [destinationNumber, setDestinationNumber] = useState('');
  const [callerIdName, setCallerIdName] = useState('');
  const [callerIdNumber, setCallerIdNumber] = useState('');
  const [connectionState, setConnectionState] = useState(voipClient.currentConnectionState);
  const [calls, setCalls] = useState<Call[]>([]);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [inputFocused, setInputFocused] = useState(false);

  const log = debug ? console.log : () => {};

  // Subscribe to connection and call state changes
  useEffect(() => {
    const connectionSubscription = voipClient.connectionState$.subscribe((state) => {
      log('TelnyxDialer: Connection state changed to:', state);
      setConnectionState(state);

      // Navigate back to login if connection is lost
      if (state === TelnyxConnectionState.DISCONNECTED || state === TelnyxConnectionState.ERROR) {
        log('TelnyxDialer: Connection lost, navigating to login');
        router.replace('/');
      }
    });

    const callsSubscription = voipClient.calls$.subscribe((calls) => {
      log('TelnyxDialer: Calls changed:', calls.length);
      setCalls(calls);
    });

    const activeCallSubscription = voipClient.activeCall$.subscribe((call) => {
      log('TelnyxDialer: Active call changed:', call?.currentState);
      setActiveCall(call);

      // Debug: Check if underlying Telnyx client is available
      if (debug) {
        log('TelnyxDialer: Checking underlying client availability:', {
          voipClientExists: !!voipClient,
          connectionState: voipClient.currentConnectionState,
          hasSessionManager: !!(voipClient as any)._sessionManager,
          telnyxClient: (voipClient as any)._sessionManager?.telnyxClient
            ? 'available'
            : 'undefined',
          telnyxClientType: typeof (voipClient as any)._sessionManager?.telnyxClient,
        });
      }
    });

    return () => {
      connectionSubscription.unsubscribe();
      callsSubscription.unsubscribe();
      activeCallSubscription.unsubscribe();
    };
  }, [voipClient, log]);

  const handleStartCall = async () => {
    if (!destinationNumber.trim()) {
      Alert.alert('Error', 'Please enter a destination number');
      return;
    }

    if (connectionState !== TelnyxConnectionState.CONNECTED) {
      Alert.alert('Error', 'Not connected to Telnyx service');
      return;
    }

    try {
      log('TelnyxDialer: Starting call to:', destinationNumber);
      log('TelnyxDialer: VoIP client state:', {
        connectionState: voipClient.currentConnectionState,
        clientAvailable: !!voipClient,
      });

      // Debug: Deep check of underlying client state
      if (debug) {
        log('TelnyxDialer: Deep client check before call:', {
          sessionManager: !!(voipClient as any)._sessionManager,
          telnyxClient: (voipClient as any)._sessionManager?.telnyxClient
            ? 'available'
            : 'undefined',
          telnyxClientConnected:
            (voipClient as any)._sessionManager?.telnyxClient?.isConnected?.() || 'unknown',
          telnyxClientState: (voipClient as any)._sessionManager?.currentState,
        });
      }

      // Add a small delay to ensure client is fully ready
      await new Promise((resolve) => setTimeout(resolve, 500));

      const call = await voipClient.newCall(
        destinationNumber,
        callerIdName || undefined,
        callerIdNumber || undefined
      );
      log('TelnyxDialer: Call initiated successfully:', call);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      log('TelnyxDialer: Error starting call:', errorMessage);
      log('TelnyxDialer: Full error:', error);
      Alert.alert('Call Failed', `Failed to start call: ${errorMessage}`);
    }
  };

  const handleAnswerCall = async (call: Call) => {
    try {
      log('TelnyxDialer: Answering call');
      await call.answer();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      log('TelnyxDialer: Error answering call:', errorMessage);
      Alert.alert('Answer Failed', errorMessage);
    }
  };

  const handleEndCall = async (call: Call) => {
    try {
      log('TelnyxDialer: Ending call');
      await call.hangup();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      log('TelnyxDialer: Error ending call:', errorMessage);
      Alert.alert('End Call Failed', errorMessage);
    }
  };

  const handleDisconnect = async () => {
    try {
      log('TelnyxDialer: Disconnecting');
      await voipClient.logout();
      router.replace('/');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      log('TelnyxDialer: Error disconnecting:', errorMessage);
      Alert.alert('Disconnect Failed', errorMessage);
    }
  };

  const isConnected = connectionState === TelnyxConnectionState.CONNECTED;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <Text
            style={[
              styles.status,
              connectionState === TelnyxConnectionState.CONNECTED && styles.statusConnected,
              connectionState === TelnyxConnectionState.DISCONNECTED && styles.statusDisconnected,
              connectionState === TelnyxConnectionState.CONNECTING && styles.statusConnecting,
            ]}
          >
            Status: {connectionState}
          </Text>
        </View>

        {isConnected && (
          <View style={styles.dialerSection}>
            <Text style={styles.sectionTitle}>Make a Call</Text>
            <TextInput
              style={[styles.input, inputFocused && styles.inputFocused]}
              placeholder="Enter destination (number, SIP URI, etc.)"
              placeholderTextColor="#999"
              value={destinationNumber}
              onChangeText={setDestinationNumber}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              keyboardType="default"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={[styles.input]}
              placeholder="Caller ID Name (optional)"
              placeholderTextColor="#999"
              value={callerIdName}
              onChangeText={setCallerIdName}
              autoCapitalize="words"
            />
            <TextInput
              style={[styles.input]}
              placeholder="Caller ID Number (optional)"
              placeholderTextColor="#999"
              value={callerIdNumber}
              onChangeText={setCallerIdNumber}
              keyboardType="phone-pad"
            />
            <TouchableOpacity style={[styles.button, styles.callButton]} onPress={handleStartCall}>
              <Text style={styles.buttonText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.disconnectButton]}
              onPress={handleDisconnect}
            >
              <Text style={styles.buttonText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  contentContainer: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  status: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    fontWeight: '500',
  },
  statusConnected: {
    color: '#28a745',
  },
  statusDisconnected: {
    color: '#dc3545',
  },
  statusConnecting: {
    color: '#ffc107',
  },
  dialerSection: {
    marginBottom: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  callsSection: {
    marginBottom: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  activeCallSection: {
    marginBottom: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    color: '#1a1a1a',
  },
  input: {
    borderWidth: 2,
    borderColor: '#d1d1d1',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    marginBottom: 16,
    backgroundColor: '#fafafa',
    color: '#333',
    fontWeight: '500',
  },
  inputFocused: {
    borderColor: '#007AFF',
    backgroundColor: '#ffffff',
  },
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 8,
    minHeight: 54,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  callButton: {
    backgroundColor: '#28a745',
  },
  answerButton: {
    backgroundColor: '#007AFF',
    flex: 1,
    marginRight: 8,
  },
  endButton: {
    backgroundColor: '#dc3545',
    flex: 1,
    marginLeft: 8,
  },
  disconnectButton: {
    backgroundColor: '#6c757d',
    marginTop: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  activeCallInfo: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  activeCallState: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
});
