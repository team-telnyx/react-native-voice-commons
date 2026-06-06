import React, { useEffect, useMemo, useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MoreVertical, Phone, PhoneOff } from 'lucide-react-native';
import {
  Call,
  TelnyxConnectionState,
  TelnyxCallState,
  createCredentialConfig,
  createTokenConfig,
  useTelnyxVoice,
} from '../react-voice-commons-sdk/src';
import { demoColors, radii, sizes, spacing } from './demoTheme';
import { VoipTokenFetcher } from './VoipTokenFetcher';
import { CredentialProfileSheet } from './login/CredentialProfileSheet';
import { InfoRow } from './login/InfoRow';
import { ProfileSwitcher } from './login/ProfileSwitcher';
import {
  SavedProfile,
  emptyProfile,
  legacyProfileKey,
  profileKey,
  upsertProfile,
  withProfileId,
} from './login/profileTypes';

interface TelnyxLoginFormProps {
  onLoginSuccess?: () => void;
  onLoginError?: (error: unknown) => void;
  debug?: boolean;
}

const PROFILE_STORAGE_KEY = '@telnyx_demo_profile';
const PROFILE_LIST_STORAGE_KEY = '@telnyx_demo_profiles';
const telnyxLogo = require('../assets/images/telnyx_logo.png');
const appPackage = require('../package.json');
const sdkPackage = require('../react-voice-commons-sdk/package.json');
const versionLabel = `Production TelnyxSDK [v${sdkPackage.version}] - App [v${appPackage.version}]`;

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
      return 'Done';
    default:
      return 'Done';
  }
}

function callStateColor(callState: TelnyxCallState | null) {
  switch (callState) {
    case TelnyxCallState.RINGING:
    case TelnyxCallState.CONNECTING:
      return demoColors.ringing;
    case TelnyxCallState.ACTIVE:
    case TelnyxCallState.HELD:
      return demoColors.selectedGreen;
    case TelnyxCallState.DROPPED:
      return demoColors.disabled;
    case TelnyxCallState.FAILED:
      return demoColors.danger;
    case TelnyxCallState.ENDED:
    default:
      return demoColors.mutedText;
  }
}

export const TelnyxLoginForm: React.FC<TelnyxLoginFormProps> = ({
  onLoginSuccess,
  onLoginError,
  debug = false,
}) => {
  const { voipClient } = useTelnyxVoice();
  const [profile, setProfile] = useState<SavedProfile | null>(null);
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<SavedProfile | null>(null);
  const [draftProfile, setDraftProfile] = useState<SavedProfile>(emptyProfile);
  const [editingProfileKey, setEditingProfileKey] = useState<string | null>(null);
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [connectionState, setConnectionState] = useState(voipClient.currentConnectionState);
  const [activeCall, setActiveCall] = useState<Call | null>(voipClient.currentActiveCall);
  const [activeCallState, setActiveCallState] = useState<TelnyxCallState | null>(
    voipClient.currentActiveCall?.currentState || null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [destinationType, setDestinationType] = useState<'sip' | 'phone'>('sip');
  const [destinationNumber, setDestinationNumber] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [isStartingCall, setIsStartingCall] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);

  const log = debug ? console.log : () => {};
  const isConnected = connectionState === TelnyxConnectionState.CONNECTED;
  const isConnecting = connectionState === TelnyxConnectionState.CONNECTING || isLoading;
  const connectButtonLabel = isConnected ? 'Disconnect' : isConnecting ? 'Cancel' : 'Connect';
  const connectionLabel = isConnected ? 'Client-ready' : 'Disconnected';
  const sessionId = isConnected ? voipClient.sessionId || '-' : '-';

  useEffect(() => {
    const subscription = voipClient.connectionState$.subscribe((state) => {
      setConnectionState(state);

      if (state === TelnyxConnectionState.CONNECTED) {
        setIsLoading(false);
        onLoginSuccess?.();
      }

      if (state === TelnyxConnectionState.ERROR || state === TelnyxConnectionState.DISCONNECTED) {
        setIsLoading(false);
        setIsStartingCall(false);
      }
    });

    loadProfile();
    return () => subscription.unsubscribe();
  }, [voipClient, onLoginSuccess]);

  useEffect(() => {
    const subscription = voipClient.activeCall$.subscribe((call) => {
      setActiveCall(call);
      setActiveCallState(call?.currentState || null);
    });

    return () => subscription.unsubscribe();
  }, [voipClient]);

  useEffect(() => {
    if (!activeCall) {
      setActiveCallState(null);
      return;
    }

    const subscription = activeCall.callState$.subscribe(setActiveCallState);
    return () => subscription.unsubscribe();
  }, [activeCall]);

  const hasProfile = useMemo(() => {
    if (!profile) return false;
    if (!profile.callerIdName.trim()) return false;
    return profile.loginMode === 'token'
      ? !!profile.sipToken.trim()
      : !!profile.sipUsername.trim() && !!profile.sipPassword.trim();
  }, [profile]);

  const handleTokenReceived = (nextToken: string) => {
    log('TelnyxLoginForm: Push token received:', nextToken);
    setPushToken(nextToken);
    AsyncStorage.setItem('@push_token', nextToken);
  };

  const loadProfile = async () => {
    try {
      const rawProfileList = await AsyncStorage.getItem(PROFILE_LIST_STORAGE_KEY);
      const rawProfile = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
      if (rawProfileList) {
        let nextProfiles = (JSON.parse(rawProfileList) as SavedProfile[]).map((item) =>
          withProfileId({
            ...emptyProfile,
            ...item,
          })
        );
        const storedProfile = rawProfile
          ? ({ ...emptyProfile, ...JSON.parse(rawProfile) } as SavedProfile)
          : null;
        const currentProfile = storedProfile
          ? nextProfiles.find(
              (item) =>
                profileKey(item) === profileKey(storedProfile) ||
                legacyProfileKey(item) === legacyProfileKey(storedProfile)
            ) || withProfileId(storedProfile)
          : nextProfiles[0] || null;
        if (
          currentProfile &&
          !nextProfiles.some((item) => profileKey(item) === profileKey(currentProfile))
        ) {
          nextProfiles = [...nextProfiles, currentProfile];
        }
        setProfiles(nextProfiles);
        setProfile(currentProfile);
        setSelectedProfile(currentProfile);
        await persistProfileList(nextProfiles);
        if (currentProfile) {
          await persistProfile(currentProfile);
        }
        return;
      }

      if (rawProfile) {
        const nextProfile = withProfileId({
          ...emptyProfile,
          ...JSON.parse(rawProfile),
        } as SavedProfile);
        setProfile(nextProfile);
        setProfiles([nextProfile]);
        setSelectedProfile(nextProfile);
        await persistProfileList([nextProfile]);
        await persistProfile(nextProfile);
        return;
      }

      const [
        storedUsername,
        storedPassword,
        storedToken,
        storedCallerIdName,
        storedCallerIdNumber,
        storedForceRelayCandidate,
      ] = await Promise.all([
        AsyncStorage.getItem('@telnyx_username'),
        AsyncStorage.getItem('@telnyx_password'),
        AsyncStorage.getItem('@credential_token'),
        AsyncStorage.getItem('@caller_id_name'),
        AsyncStorage.getItem('@caller_id_number'),
        AsyncStorage.getItem('@force_relay_candidate'),
      ]);

      if (storedUsername || storedToken || storedCallerIdName) {
        const migratedProfile = withProfileId({
          loginMode: storedToken ? 'token' : 'credentials',
          sipUsername: storedUsername || '',
          sipPassword: storedPassword || '',
          sipToken: storedToken || '',
          callerIdName: storedCallerIdName || '',
          callerIdNumber: storedCallerIdNumber || '',
          forceRelayCandidate: storedForceRelayCandidate === 'true',
        } as SavedProfile);
        setProfile(migratedProfile);
        setProfiles([migratedProfile]);
        setSelectedProfile(migratedProfile);
        await persistProfileList([migratedProfile]);
        await persistProfile(migratedProfile);
      }
    } catch (error) {
      log('TelnyxLoginForm: Error loading profile:', error);
    }
  };

  const persistProfile = async (nextProfile: SavedProfile) => {
    // Demo-only persistence. Production apps should store SIP secrets in Keychain/Keystore.
    await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(nextProfile));
    await Promise.all([
      AsyncStorage.setItem('@caller_id_name', nextProfile.callerIdName.trim()),
      AsyncStorage.setItem('@caller_id_number', nextProfile.callerIdNumber.trim()),
      AsyncStorage.setItem('@force_relay_candidate', String(nextProfile.forceRelayCandidate)),
      nextProfile.loginMode === 'credentials'
        ? AsyncStorage.setItem('@telnyx_username', nextProfile.sipUsername.trim())
        : AsyncStorage.removeItem('@telnyx_username'),
      nextProfile.loginMode === 'credentials'
        ? AsyncStorage.setItem('@telnyx_password', nextProfile.sipPassword)
        : AsyncStorage.removeItem('@telnyx_password'),
      nextProfile.loginMode === 'token'
        ? AsyncStorage.setItem('@credential_token', nextProfile.sipToken.trim())
        : AsyncStorage.removeItem('@credential_token'),
    ]);
  };

  const persistProfileList = async (nextProfiles: SavedProfile[]) => {
    // Demo-only persistence. Production apps should store SIP secrets in Keychain/Keystore.
    await AsyncStorage.setItem(PROFILE_LIST_STORAGE_KEY, JSON.stringify(nextProfiles));
  };

  const removeCurrentProfilePersistence = async () => {
    await AsyncStorage.removeItem(PROFILE_STORAGE_KEY);
    await Promise.all([
      AsyncStorage.removeItem('@telnyx_username'),
      AsyncStorage.removeItem('@telnyx_password'),
      AsyncStorage.removeItem('@credential_token'),
      AsyncStorage.removeItem('@caller_id_name'),
      AsyncStorage.removeItem('@caller_id_number'),
      AsyncStorage.removeItem('@force_relay_candidate'),
    ]);
  };

  const openProfileSheet = (editableProfile: SavedProfile | null = profile) => {
    setDraftProfile(editableProfile ? { ...editableProfile } : emptyProfile);
    setSelectedProfile(profile);
    setShowProfileSheet(true);
  };

  const handleSaveProfile = async (): Promise<boolean> => {
    const normalizedProfile = withProfileId({
      ...draftProfile,
      sipUsername: draftProfile.sipUsername.trim(),
      sipToken: draftProfile.sipToken.trim(),
      callerIdName: draftProfile.callerIdName.trim(),
      callerIdNumber: draftProfile.callerIdNumber.trim(),
    });

    if (normalizedProfile.loginMode === 'credentials') {
      if (
        !normalizedProfile.sipUsername ||
        !normalizedProfile.sipPassword ||
        !normalizedProfile.callerIdName
      ) {
        Alert.alert('Error', 'Please fill all fields');
        return false;
      }
    } else if (!normalizedProfile.sipToken || !normalizedProfile.callerIdName) {
      Alert.alert('Error', 'Please fill all fields');
      return false;
    }

    const nextProfiles = upsertProfile(profiles, normalizedProfile, editingProfileKey);
    await persistProfileList(nextProfiles);
    await persistProfile(normalizedProfile);
    setProfiles(nextProfiles);
    setProfile(normalizedProfile);
    setSelectedProfile(normalizedProfile);
    setEditingProfileKey(null);
    setShowProfileSheet(false);
    await loginWithProfile(normalizedProfile);
    return true;
  };

  const handleConfirmProfile = async () => {
    if (selectedProfile) {
      setProfile(selectedProfile);
      await persistProfile(selectedProfile);
    }
    setShowProfileSheet(false);
  };

  const handleCancelProfileSelection = () => {
    setSelectedProfile(profile);
    setShowProfileSheet(false);
  };

  const deleteProfile = async (targetProfile: SavedProfile) => {
    const targetKey = profileKey(targetProfile);

    const nextProfiles = profiles.filter((item) => profileKey(item) !== targetKey);
    const didDeleteCurrent = !!profile && profileKey(profile) === targetKey;
    const nextCurrentProfile = didDeleteCurrent ? null : profile;

    setProfiles(nextProfiles);
    setProfile(nextCurrentProfile);
    setSelectedProfile(nextCurrentProfile || nextProfiles[0] || null);
    await persistProfileList(nextProfiles);

    if (didDeleteCurrent) {
      await removeCurrentProfilePersistence();
    }
  };

  const handleDeleteProfile = (targetProfile: SavedProfile) => {
    Alert.alert('Delete profile', `Delete ${targetProfile.callerIdName || 'this profile'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteProfile(targetProfile);
        },
      },
    ]);
  };

  const loginWithProfile = async (nextProfile: SavedProfile) => {
    setIsLoading(true);

    try {
      if (nextProfile.loginMode === 'token') {
        await voipClient.loginWithToken(
          createTokenConfig(nextProfile.sipToken, {
            debug: true,
            pushNotificationDeviceToken: pushToken || undefined,
            useTrickleIce: true,
          })
        );
      } else {
        await voipClient.login(
          createCredentialConfig(nextProfile.sipUsername, nextProfile.sipPassword, {
            debug: true,
            pushNotificationDeviceToken: pushToken || undefined,
            useTrickleIce: true,
          })
        );
      }
    } catch (error) {
      setIsLoading(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Login Failed', errorMessage);
      onLoginError?.(error);
    }
  };

  const handleConnectDisconnect = async () => {
    if (isConnecting && !isConnected) {
      setIsLoading(false);
      try {
        await voipClient.logout();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        Alert.alert('Cancel Failed', errorMessage);
      }
      return;
    }

    if (isConnected) {
      await voipClient.logout();
      return;
    }

    if (!profile || !hasProfile) {
      Alert.alert('Profile', 'Please select a profile');
      return;
    }

    await loginWithProfile(profile);
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
      log('TelnyxLoginForm: Starting call to:', destinationNumber);
      await voipClient.newCall(
        destinationNumber.trim(),
        profile?.callerIdName.trim() || undefined,
        profile?.callerIdNumber.trim() || undefined
      );
      setIsStartingCall(false);
    } catch (error) {
      setIsStartingCall(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      log('TelnyxLoginForm: Error starting call:', errorMessage);
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
      log('TelnyxLoginForm: Error ending call:', errorMessage);
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
      log('TelnyxLoginForm: Error answering call:', errorMessage);
      Alert.alert('Answer Call Failed', errorMessage);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <VoipTokenFetcher onTokenReceived={handleTokenReceived} debug={debug} />
      <View style={styles.root} testID="homeScreenRoot">
        <View style={styles.topBar}>
          <View style={styles.topSpacer} />
          <Image
            source={telnyxLogo}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Telnyx WebRTC"
          />
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => Alert.alert('Menu', 'Websocket Messages')}
            testID="menuButton"
            accessibilityLabel="Menu"
          >
            <MoreVertical size={24} color={demoColors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.instructions}>
            {isConnected
              ? 'Enter a destination (phone number or SIP user) to initiate your call.'
              : 'Please confirm details below and click Connect to make a call.'}
          </Text>

          {!isConnected && (
            <ProfileSwitcher
              profileName={profile?.callerIdName || 'No Profile'}
              onPress={() => openProfileSheet(profile)}
            />
          )}

          <InfoRow label="Socket" testID="socketStatus">
            <View
              style={[
                styles.stateDot,
                {
                  backgroundColor: isConnected ? demoColors.selectedGreen : demoColors.danger,
                },
              ]}
            />
            <Text style={styles.infoValue}>{connectionLabel}</Text>
          </InfoRow>

          <InfoRow label="Session ID">
            <Text style={styles.infoValue}>{sessionId}</Text>
          </InfoRow>

          {!isConnected && (
            <InfoRow label="Call State">
              <View
                style={[styles.stateDot, { backgroundColor: callStateColor(activeCallState) }]}
              />
              <Text style={styles.infoValue}>{callStateLabel(activeCallState)}</Text>
            </InfoRow>
          )}

          {isConnected && (
            <View style={styles.callSection}>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[styles.segment, destinationType === 'sip' && styles.segmentSelected]}
                  onPress={() => setDestinationType('sip')}
                  testID="sipAddressToggle"
                  accessibilityLabel="SIP address"
                >
                  <Text
                    style={[
                      styles.segmentText,
                      destinationType === 'sip' && styles.segmentTextSelected,
                    ]}
                  >
                    SIP address
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segment, destinationType === 'phone' && styles.segmentSelected]}
                  onPress={() => setDestinationType('phone')}
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
                placeholder={
                  destinationType === 'phone' ? 'Enter phone number' : 'Enter SIP address'
                }
                placeholderTextColor="gray"
                value={destinationNumber}
                onChangeText={setDestinationNumber}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType={destinationType === 'phone' ? 'phone-pad' : 'default'}
                testID="numberToCallTextField"
                accessibilityLabel="Call input"
              />

              {isStartingCall || activeCall ? (
                <View style={styles.inlineCallState} testID="callConnectingView">
                  <View style={styles.inlineCallText}>
                    <Text style={styles.inlineCallLabel}>
                      {isStartingCall ? 'Connecting' : callStateLabel(activeCallState)}
                    </Text>
                    <Text style={styles.inlineCallDestination} numberOfLines={1}>
                      {activeCall?.callerName ||
                        activeCall?.callerNumber ||
                        destinationNumber.trim()}
                    </Text>
                  </View>
                  {activeCall?.isIncoming && activeCallState === TelnyxCallState.RINGING ? (
                    <View style={styles.inlineCallActions}>
                      <TouchableOpacity
                        style={styles.inlineEndButton}
                        onPress={handleEndCall}
                        testID="callReject"
                        accessibilityRole="button"
                        accessibilityLabel="Reject"
                        activeOpacity={0.75}
                      >
                        <PhoneOff size={20} color={demoColors.white} pointerEvents="none" />
                        <Text style={styles.callActionText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.inlineAnswerButton}
                        onPress={handleAnswerCall}
                        testID="callAnswer"
                        accessibilityRole="button"
                        accessibilityLabel="Answer"
                        activeOpacity={0.75}
                      >
                        <Phone size={20} color={demoColors.text} pointerEvents="none" />
                        <Text style={styles.answerActionText}>Answer</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.inlineEndButton}
                      onPress={handleEndCall}
                      testID="hangupButton"
                      accessibilityRole="button"
                      accessibilityLabel="End"
                      activeOpacity={0.75}
                    >
                      <PhoneOff size={20} color={demoColors.white} pointerEvents="none" />
                      <Text style={styles.callActionText}>Hangup</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={handleStartCall}
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
          )}
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.connectButton}
            onPress={handleConnectDisconnect}
            testID={isConnected ? 'disconnectButton' : 'connectDisconnectButton'}
            accessibilityLabel={connectButtonLabel}
          >
            <Text style={styles.connectButtonText}>{connectButtonLabel}</Text>
          </TouchableOpacity>
          <Text style={styles.versionText}>{versionLabel}</Text>
        </View>
      </View>

      <CredentialProfileSheet
        visible={showProfileSheet}
        profiles={profiles}
        selectedProfile={selectedProfile}
        draftProfile={draftProfile}
        setDraftProfile={setDraftProfile}
        setSelectedProfile={setSelectedProfile}
        onEditProfile={(nextProfile) => {
          setDraftProfile(nextProfile ? { ...nextProfile } : emptyProfile);
          setEditingProfileKey(nextProfile ? profileKey(nextProfile) : null);
        }}
        onDeleteProfile={handleDeleteProfile}
        onSave={handleSaveProfile}
        onConfirm={handleConfirmProfile}
        onCancel={handleCancelProfileSelection}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: demoColors.background,
  },
  root: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    backgroundColor: demoColors.background,
  },
  topBar: {
    minHeight: 148,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xl,
  },
  topSpacer: {
    width: 48,
  },
  logo: {
    width: 200,
    height: 100,
  },
  menuButton: {
    width: 48,
    alignItems: 'flex-end',
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  instructions: {
    color: demoColors.text,
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  infoValue: {
    color: demoColors.text,
    fontSize: 14,
  },
  stateDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  callSection: {
    alignItems: 'center',
    gap: spacing.md,
  },
  segmentedControl: {
    width: '100%',
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
    width: '100%',
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
  inlineCallState: {
    width: '100%',
    minHeight: 64,
    borderWidth: 1,
    borderColor: demoColors.outline,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: demoColors.white,
  },
  inlineCallText: {
    flex: 1,
    marginRight: spacing.md,
  },
  inlineCallLabel: {
    color: demoColors.mutedText,
    fontSize: 14,
    marginBottom: 2,
  },
  inlineCallDestination: {
    color: demoColors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  inlineCallActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  inlineEndButton: {
    minWidth: 104,
    height: 48,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: demoColors.danger,
  },
  inlineAnswerButton: {
    minWidth: 104,
    height: 48,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: demoColors.telnyxGreen,
  },
  callActionText: {
    color: demoColors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  answerActionText: {
    color: demoColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  bottomBar: {
    minHeight: 128,
    justifyContent: 'center',
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  connectButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: demoColors.background,
    borderRadius: 20,
    backgroundColor: demoColors.text,
  },
  connectButtonText: {
    color: demoColors.background,
    fontSize: 16,
  },
  versionText: {
    color: demoColors.mutedText,
    textAlign: 'center',
    fontSize: 14,
  },
});
