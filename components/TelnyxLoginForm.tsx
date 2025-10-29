import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  TelnyxVoipClient,
  TelnyxConnectionState,
  createCredentialConfig,
  createTokenConfig,
  useTelnyxVoice,
} from '../react-voice-commons-sdk/src';
import { VoipTokenFetcher } from './VoipTokenFetcher';

interface TelnyxLoginFormProps {
  onLoginSuccess?: () => void;
  onLoginError?: (error: any) => void;
  debug?: boolean;
}

type LoginMode = 'credentials' | 'token';

export const TelnyxLoginForm: React.FC<TelnyxLoginFormProps> = ({
  onLoginSuccess,
  onLoginError,
  debug = false,
}) => {
  const { voipClient } = useTelnyxVoice();
  const [loginMode, setLoginMode] = useState<LoginMode>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionState, setConnectionState] = useState(voipClient.currentConnectionState);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [pushToken, setPushToken] = useState<string | null>(null);

  const log = debug ? console.log : () => {};

  // Handle VoIP/Push token reception
  const handleTokenReceived = (token: string) => {
    log('TelnyxLoginForm: Push token received:', token);
    setPushToken(token);
    // Store the token for use in push notification logins
    AsyncStorage.setItem('@push_token', token);
  };

  // Subscribe to connection state changes
  useEffect(() => {
    const subscription = voipClient.connectionState$.subscribe((state) => {
      log('TelnyxLoginForm: Connection state changed to:', state);
      setConnectionState(state);

      if (state === TelnyxConnectionState.CONNECTED) {
        setIsLoading(false);
        onLoginSuccess?.();
        log('TelnyxLoginForm: Login successful, navigating to dialer');
        router.push('/dialer');
      } else if (state === TelnyxConnectionState.ERROR) {
        setIsLoading(false);
        log('TelnyxLoginForm: Connection error');
      }
    });

    return () => subscription.unsubscribe();
  }, [voipClient, onLoginSuccess, log]);

  // Load stored credentials on mount
  useEffect(() => {
    loadStoredCredentials();
  }, []);

  const loadStoredCredentials = async () => {
    try {
      const storedUsername = await AsyncStorage.getItem('@telnyx_username');
      const storedPassword = await AsyncStorage.getItem('@telnyx_password');
      const storedToken = await AsyncStorage.getItem('@credential_token');

      if (storedUsername) setUsername(storedUsername);
      if (storedPassword) setPassword(storedPassword);
      if (storedToken) {
        setToken(storedToken);
        setLoginMode('token'); // Switch to token mode if token exists
      }

      log('TelnyxLoginForm: Loaded stored credentials and token');
    } catch (error) {
      log('TelnyxLoginForm: Error loading stored credentials:', error);
    }
  };

  const saveCredentials = async () => {
    try {
      if (loginMode === 'credentials') {
        await AsyncStorage.setItem('@telnyx_username', username);
        await AsyncStorage.setItem('@telnyx_password', password);
        // Clear token when using credentials
        await AsyncStorage.removeItem('@credential_token');
      } else {
        await AsyncStorage.setItem('@credential_token', token);
        // Clear credentials when using token
        await AsyncStorage.removeItem('@telnyx_username');
        await AsyncStorage.removeItem('@telnyx_password');
      }
      
      if (pushToken) {
        await AsyncStorage.setItem('@push_token', pushToken);
        log(`TelnyxLoginForm: ${loginMode} and push token saved`);
      } else {
        log(`TelnyxLoginForm: ${loginMode} saved (no push token yet)`);
      }
    } catch (error) {
      log('TelnyxLoginForm: Error saving credentials:', error);
    }
  };

  const handleLogin = async () => {
    if (loginMode === 'credentials') {
      if (!username.trim() || !password.trim()) {
        Alert.alert('Error', 'Username and password are required');
        return;
      }
    } else {
      if (!token.trim()) {
        Alert.alert('Error', 'Token is required');
        return;
      }
    }

    setIsLoading(true);
    log(`TelnyxLoginForm: Starting ${loginMode} login process`);

    try {
      // Save credentials/token first
      await saveCredentials();

      if (loginMode === 'credentials') {
        // Create credential config with push token
        const config = createCredentialConfig(username, password, {
          debug: true,
          pushNotificationDeviceToken: pushToken || undefined,
        });

        log('TelnyxLoginForm: Connecting with credentials and push token:', pushToken);
        await voipClient.login(config);
      } else {
        // Create token config with push token
        const config = createTokenConfig(token, {
          debug: true,
          pushNotificationDeviceToken: pushToken || undefined,
        });

        log('TelnyxLoginForm: Connecting with token and push token:', pushToken);
        await voipClient.loginWithToken(config);
      }
    } catch (error) {
      setIsLoading(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      log('TelnyxLoginForm: Login error:', errorMessage);
      Alert.alert('Login Failed', errorMessage);
      onLoginError?.(error);
    }
  };

  const isConnecting = connectionState === TelnyxConnectionState.CONNECTING;
  const isConnected = connectionState === TelnyxConnectionState.CONNECTED;

  return (
    <SafeAreaView style={styles.safeArea}>
      <VoipTokenFetcher onTokenReceived={handleTokenReceived} debug={debug} />
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <View style={styles.card}>
              <Text style={styles.title}>Telnyx Login</Text>
              <Text style={styles.description}>Enter your SIP credentials to connect</Text>

              {/* Tab Interface */}
              <View style={styles.tabContainer}>
                <TouchableOpacity
                  style={[styles.tab, loginMode === 'credentials' && styles.activeTab]}
                  onPress={() => setLoginMode('credentials')}
                  disabled={isLoading || isConnected}
                >
                  <Text style={[styles.tabText, loginMode === 'credentials' && styles.activeTabText]}>
                    Credentials
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, loginMode === 'token' && styles.activeTab]}
                  onPress={() => setLoginMode('token')}
                  disabled={isLoading || isConnected}
                >
                  <Text style={[styles.tabText, loginMode === 'token' && styles.activeTabText]}>
                    Token
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.form}>
                {loginMode === 'credentials' ? (
                  <>
                    <TextInput
                      style={[styles.input, focusedInput === 'username' && styles.inputFocused]}
                      placeholder="SIP Username"
                      placeholderTextColor="#999"
                      value={username}
                      onChangeText={setUsername}
                      onFocus={() => setFocusedInput('username')}
                      onBlur={() => setFocusedInput(null)}
                      editable={!isLoading && !isConnected}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />

                    <TextInput
                      style={[styles.input, focusedInput === 'password' && styles.inputFocused]}
                      placeholder="SIP Password"
                      placeholderTextColor="#999"
                      value={password}
                      onChangeText={setPassword}
                      onFocus={() => setFocusedInput('password')}
                      onBlur={() => setFocusedInput(null)}
                      secureTextEntry
                      editable={!isLoading && !isConnected}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </>
                ) : (
                  <TextInput
                    style={[styles.input, focusedInput === 'token' && styles.inputFocused]}
                    placeholder="Authentication Token"
                    placeholderTextColor="#999"
                    value={token}
                    onChangeText={setToken}
                    onFocus={() => setFocusedInput('token')}
                    onBlur={() => setFocusedInput(null)}
                    editable={!isLoading && !isConnected}
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                )}

                <TouchableOpacity
                  style={[styles.button, (isLoading || isConnected) && styles.buttonDisabled]}
                  onPress={handleLogin}
                  disabled={isLoading || isConnected}
                >
                  {isLoading || isConnecting ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.buttonText}>{isConnected ? 'Connected' : 'Connect'}</Text>
                  )}
                </TouchableOpacity>

                <Text style={styles.status}>Status: {connectionState}</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100%',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 24,
  },
  form: {
    gap: 16,
  },
  input: {
    borderWidth: 2,
    borderColor: '#d1d1d1',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#fafafa',
    color: '#333',
  },
  inputFocused: {
    borderColor: '#007AFF',
    backgroundColor: '#ffffff',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  status: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
