import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react-native';
import {
  Call,
  TelnyxConnectionState,
  TelnyxCallState,
  createCredentialConfig,
  createTokenConfig,
  useTelnyxVoice,
} from '../react-voice-commons-sdk/src';
import { demoColors, radii, spacing } from './demoTheme';
import { VoipTokenFetcher } from './VoipTokenFetcher';

interface TelnyxLoginFormProps {
  onLoginSuccess?: () => void;
  onLoginError?: (error: unknown) => void;
  debug?: boolean;
}

type LoginMode = 'credentials' | 'token';

type SavedProfile = {
  loginMode: LoginMode;
  sipUsername: string;
  sipPassword: string;
  sipToken: string;
  callerIdName: string;
  callerIdNumber: string;
  forceRelayCandidate: boolean;
};

const emptyProfile: SavedProfile = {
  loginMode: 'credentials',
  sipUsername: '',
  sipPassword: '',
  sipToken: '',
  callerIdName: '',
  callerIdNumber: '',
  forceRelayCandidate: false,
};

const PROFILE_STORAGE_KEY = '@telnyx_demo_profile';
const PROFILE_LIST_STORAGE_KEY = '@telnyx_demo_profiles';
const telnyxLogo = require('../assets/images/telnyx_logo.png');

function profileKey(nextProfile: SavedProfile) {
  return `${nextProfile.loginMode}:${nextProfile.callerIdName}:${nextProfile.loginMode === 'token' ? nextProfile.sipToken : nextProfile.sipUsername}`;
}

function upsertProfile(
  currentProfiles: SavedProfile[],
  nextProfile: SavedProfile,
  originalProfileKey?: string | null
) {
  const nextKey = profileKey(nextProfile);
  const existingIndex = currentProfiles.findIndex(
    (item) => profileKey(item) === (originalProfileKey || nextKey)
  );

  if (existingIndex === -1) {
    return [...currentProfiles, nextProfile];
  }

  return currentProfiles.map((item, index) => (index === existingIndex ? nextProfile : item));
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
  const [pushToken, setPushToken] = useState<string | null>(null);

  const log = debug ? console.log : () => {};
  const isConnected = connectionState === TelnyxConnectionState.CONNECTED;
  const isConnecting = connectionState === TelnyxConnectionState.CONNECTING || isLoading;
  const connectionLabel = isConnected ? 'Client-ready' : 'Disconnected';
  const sessionId = isConnected ? voipClient.sessionId || '-' : '-';

  useEffect(() => {
    const subscription = voipClient.connectionState$.subscribe((state) => {
      setConnectionState(state);

      if (state === TelnyxConnectionState.CONNECTED) {
        setIsLoading(false);
        onLoginSuccess?.();
        router.push('/dialer');
      }

      if (state === TelnyxConnectionState.ERROR || state === TelnyxConnectionState.DISCONNECTED) {
        setIsLoading(false);
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
        const nextProfiles = (JSON.parse(rawProfileList) as SavedProfile[]).map((item) => ({
          ...emptyProfile,
          ...item,
        }));
        const currentProfile = rawProfile
          ? ({ ...emptyProfile, ...JSON.parse(rawProfile) } as SavedProfile)
          : nextProfiles[0] || null;
        setProfiles(nextProfiles);
        setProfile(currentProfile);
        setSelectedProfile(currentProfile);
        return;
      }

      if (rawProfile) {
        const nextProfile = { ...emptyProfile, ...JSON.parse(rawProfile) } as SavedProfile;
        setProfile(nextProfile);
        setProfiles([nextProfile]);
        setSelectedProfile(nextProfile);
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
        const migratedProfile = {
          loginMode: storedToken ? 'token' : 'credentials',
          sipUsername: storedUsername || '',
          sipPassword: storedPassword || '',
          sipToken: storedToken || '',
          callerIdName: storedCallerIdName || '',
          callerIdNumber: storedCallerIdNumber || '',
          forceRelayCandidate: storedForceRelayCandidate === 'true',
        } as SavedProfile;
        setProfile(migratedProfile);
        setProfiles([migratedProfile]);
        setSelectedProfile(migratedProfile);
      }
    } catch (error) {
      log('TelnyxLoginForm: Error loading profile:', error);
    }
  };

  const persistProfile = async (nextProfile: SavedProfile) => {
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
    const normalizedProfile = {
      ...draftProfile,
      sipUsername: draftProfile.sipUsername.trim(),
      sipToken: draftProfile.sipToken.trim(),
      callerIdName: draftProfile.callerIdName.trim(),
      callerIdNumber: draftProfile.callerIdNumber.trim(),
    };

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
    setProfiles(nextProfiles);
    setSelectedProfile(normalizedProfile);
    setEditingProfileKey(null);
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

  const handleDeleteProfile = async () => {
    if (!selectedProfile) return;

    const nextProfiles = profiles.filter(
      (item) => profileKey(item) !== profileKey(selectedProfile)
    );
    const didDeleteCurrent = profile && profileKey(profile) === profileKey(selectedProfile);
    const nextCurrentProfile = didDeleteCurrent ? null : profile;

    setProfiles(nextProfiles);
    setProfile(nextCurrentProfile);
    setSelectedProfile(nextCurrentProfile || nextProfiles[0] || null);
    await persistProfileList(nextProfiles);

    if (didDeleteCurrent) {
      await removeCurrentProfilePersistence();
    }
  };

  const handleConnectDisconnect = async () => {
    if (isConnected) {
      await voipClient.logout();
      return;
    }

    if (!profile || !hasProfile) {
      Alert.alert('Profile', 'Please select a profile');
      return;
    }

    setIsLoading(true);

    try {
      if (profile.loginMode === 'token') {
        await voipClient.loginWithToken(
          createTokenConfig(profile.sipToken, {
            debug: true,
            pushNotificationDeviceToken: pushToken || undefined,
          })
        );
      } else {
        await voipClient.login(
          createCredentialConfig(profile.sipUsername, profile.sipPassword, {
            debug: true,
            pushNotificationDeviceToken: pushToken || undefined,
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
          <ProfileSwitcher
            profileName={profile?.callerIdName || 'No Profile'}
            onPress={() => openProfileSheet(profile)}
          />

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

          <InfoRow label="Call State">
            <View style={[styles.stateDot, { backgroundColor: callStateColor(activeCallState) }]} />
            <Text style={styles.infoValue}>{callStateLabel(activeCallState)}</Text>
          </InfoRow>
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.connectButton}
            onPress={handleConnectDisconnect}
            disabled={isConnecting}
            testID="connectDisconnectButton"
            accessibilityLabel={isConnected ? 'Disconnect' : 'Connect'}
          >
            {isConnecting ? (
              <ActivityIndicator color={demoColors.background} />
            ) : (
              <Text style={styles.connectButtonText}>{isConnected ? 'Disconnect' : 'Connect'}</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.versionText}>Production TelnyxSDK [v-] - App [v1.0.0]</Text>
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

type ProfileSwitcherProps = {
  profileName: string;
  onPress: () => void;
};

function ProfileSwitcher({ profileName, onPress }: ProfileSwitcherProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.infoLabel}>Profile</Text>
      <View style={styles.profileSwitcherRow}>
        <Text style={styles.infoValue} testID="profileName">
          {profileName}
        </Text>
        <TouchableOpacity
          style={styles.smallPillButton}
          onPress={onPress}
          testID="switchProfileButton"
          accessibilityLabel="Switch profile"
        >
          <Plus size={16} color={demoColors.text} />
          <Text style={styles.smallPillText}>Switch profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

type InfoRowProps = {
  label: string;
  testID?: string;
  children: React.ReactNode;
};

function InfoRow({ label, testID, children }: InfoRowProps) {
  return (
    <View style={styles.section} testID={testID}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValueRow}>{children}</View>
    </View>
  );
}

type CredentialProfileSheetProps = {
  visible: boolean;
  profiles: SavedProfile[];
  selectedProfile: SavedProfile | null;
  draftProfile: SavedProfile;
  setDraftProfile: React.Dispatch<React.SetStateAction<SavedProfile>>;
  setSelectedProfile: React.Dispatch<React.SetStateAction<SavedProfile | null>>;
  onEditProfile: (profile: SavedProfile | null) => void;
  onDeleteProfile: () => void;
  onSave: () => Promise<boolean>;
  onConfirm: () => void;
  onCancel: () => void;
};

function CredentialProfileSheet({
  visible,
  profiles,
  selectedProfile,
  draftProfile,
  setDraftProfile,
  setSelectedProfile,
  onEditProfile,
  onDeleteProfile,
  onSave,
  onConfirm,
  onCancel,
}: CredentialProfileSheetProps) {
  const [isAddProfile, setIsAddProfile] = useState(false);
  const isTokenState = draftProfile.loginMode === 'token';

  useEffect(() => {
    if (visible) {
      setIsAddProfile(false);
    }
  }, [visible]);

  const handleAddProfile = () => {
    onEditProfile(null);
    setIsAddProfile((current) => !current);
  };

  const handleEditProfile = (nextProfile: SavedProfile) => {
    onEditProfile(nextProfile);
    setIsAddProfile(true);
  };

  const handleSaveProfile = async () => {
    const didSave = await onSave();
    if (didSave) {
      setIsAddProfile(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => {}}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetScrim}
      >
        <View style={styles.sheet}>
          <ScrollView style={styles.sheetScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.loginSheetContent}>
              <Text style={styles.sheetTitle}>Existing profiles</Text>

              <TouchableOpacity
                style={styles.addProfileButton}
                onPress={handleAddProfile}
                testID="addNewProfileButton"
                accessibilityLabel="Add new profile"
              >
                <Plus size={16} color={demoColors.text} />
                <Text style={styles.addProfileText}>Add new profile</Text>
              </TouchableOpacity>

              <Text style={styles.infoValue}>Production</Text>

              {profiles.length > 0 && (
                <View style={styles.profileList} testID="profileList">
                  {profiles.map((nextProfile) => {
                    const isSelected =
                      !!selectedProfile && profileKey(selectedProfile) === profileKey(nextProfile);

                    return (
                      <TouchableOpacity
                        key={profileKey(nextProfile)}
                        style={[styles.profileItem, isSelected && styles.profileItemSelected]}
                        onPress={() => setSelectedProfile(nextProfile)}
                      >
                        <Text style={styles.profileItemText}>{nextProfile.callerIdName}</Text>
                        {isSelected && (
                          <>
                            <TouchableOpacity
                              onPress={() => handleEditProfile(nextProfile)}
                              accessibilityLabel="Edit profile"
                            >
                              <Pencil size={22} color={demoColors.text} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={onDeleteProfile}
                              accessibilityLabel="Delete profile"
                            >
                              <Trash2 size={22} color={demoColors.text} />
                            </TouchableOpacity>
                          </>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <View style={styles.sheetActions}>
                <TouchableOpacity
                  style={[styles.sheetActionButton, styles.cancelButton]}
                  onPress={onCancel}
                  testID="cancelButton"
                  accessibilityLabel="Cancel"
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sheetActionButton}
                  onPress={onConfirm}
                  testID="confirmButton"
                  accessibilityLabel="Confirm"
                >
                  <Text style={styles.saveButtonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>

            {isAddProfile && (
              <View style={styles.credentialsForm} testID="credentialsForm">
                <View style={styles.segmentedControl}>
                  <TouchableOpacity
                    style={[styles.segment, !isTokenState && styles.segmentSelected]}
                    onPress={() =>
                      setDraftProfile((current) => ({ ...current, loginMode: 'credentials' }))
                    }
                    testID="credentialLoginToggleButton"
                    accessibilityLabel="Credential Login"
                  >
                    <Text style={[styles.segmentText, !isTokenState && styles.segmentTextSelected]}>
                      Credential Login
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.segment, isTokenState && styles.segmentSelected]}
                    onPress={() =>
                      setDraftProfile((current) => ({ ...current, loginMode: 'token' }))
                    }
                    testID="tokenLoginToggleButton"
                    accessibilityLabel="Token Login"
                  >
                    <Text style={[styles.segmentText, isTokenState && styles.segmentTextSelected]}>
                      Token Login
                    </Text>
                  </TouchableOpacity>
                </View>

                {!isTokenState ? (
                  <>
                    <LabeledInput
                      label="Username"
                      placeholder="Enter username"
                      value={draftProfile.sipUsername}
                      onChangeText={(sipUsername) =>
                        setDraftProfile((current) => ({ ...current, sipUsername }))
                      }
                      testID="sipUsername"
                    />
                    <LabeledInput
                      label="Password"
                      placeholder="Enter password"
                      value={draftProfile.sipPassword}
                      onChangeText={(sipPassword) =>
                        setDraftProfile((current) => ({ ...current, sipPassword }))
                      }
                      secureTextEntry
                      testID="sipPassword"
                    />
                  </>
                ) : (
                  <LabeledInput
                    label="Token"
                    placeholder="Enter token"
                    value={draftProfile.sipToken}
                    onChangeText={(sipToken) =>
                      setDraftProfile((current) => ({ ...current, sipToken }))
                    }
                    testID="sipToken"
                  />
                )}

                <LabeledInput
                  label="Caller name"
                  placeholder="Enter caller name"
                  value={draftProfile.callerIdName}
                  onChangeText={(callerIdName) =>
                    setDraftProfile((current) => ({ ...current, callerIdName }))
                  }
                  testID="callerIDName"
                />
                <LabeledInput
                  label="Caller number"
                  placeholder="Enter caller number"
                  value={draftProfile.callerIdNumber}
                  onChangeText={(callerIdNumber) =>
                    setDraftProfile((current) => ({ ...current, callerIdNumber }))
                  }
                  keyboardType="phone-pad"
                  testID="callerIDNumber"
                />

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Force TURN Relay</Text>
                  <Switch
                    value={draftProfile.forceRelayCandidate}
                    onValueChange={(forceRelayCandidate) =>
                      setDraftProfile((current) => ({ ...current, forceRelayCandidate }))
                    }
                    testID="forceRelayCandidate"
                    accessibilityLabel="Force TURN Relay"
                  />
                </View>

                <View style={styles.sheetActions}>
                  <TouchableOpacity
                    style={styles.sheetActionButton}
                    onPress={handleSaveProfile}
                    testID="saveButton"
                    accessibilityLabel="Save"
                  >
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type LabeledInputProps = React.ComponentProps<typeof TextInput> & {
  label: string;
};

function LabeledInput({ label, style, ...props }: LabeledInputProps) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        {...props}
        style={[styles.input, style]}
        placeholderTextColor="gray"
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

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
  section: {
    gap: 4,
  },
  infoLabel: {
    color: demoColors.text,
    fontSize: 14,
  },
  infoValueRow: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
  profileSwitcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  smallPillButton: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: demoColors.text,
    borderRadius: 20,
    backgroundColor: demoColors.background,
  },
  smallPillText: {
    color: demoColors.text,
    fontSize: 14,
  },
  profileList: {
    gap: spacing.xs,
  },
  profileItem: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: demoColors.secondarySurface,
  },
  profileItemSelected: {
    backgroundColor: demoColors.secondarySurface,
  },
  profileItemText: {
    flex: 1,
    color: demoColors.text,
    fontSize: 14,
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
  sheetScrim: {
    flex: 1,
    justifyContent: 'flex-start',
    backgroundColor: demoColors.white,
  },
  sheet: {
    flex: 1,
    width: '100%',
    backgroundColor: demoColors.white,
    padding: spacing.lg,
  },
  sheetScroll: {
    flex: 1,
  },
  loginSheetContent: {
    gap: spacing.lg,
    backgroundColor: demoColors.white,
  },
  sheetTitle: {
    color: demoColors.text,
    fontSize: 16,
  },
  addProfileButton: {
    alignSelf: 'flex-start',
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: demoColors.secondarySurface,
    borderRadius: 20,
    backgroundColor: demoColors.secondarySurface,
  },
  addProfileText: {
    color: demoColors.text,
    fontSize: 12,
  },
  credentialsForm: {
    gap: spacing.sm,
    backgroundColor: demoColors.white,
    marginTop: spacing.lg,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: demoColors.outline,
    borderRadius: radii.sm,
    overflow: 'hidden',
    marginTop: 6,
  },
  segment: {
    flex: 1,
    minHeight: 48,
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
    textAlign: 'center',
  },
  segmentTextSelected: {
    color: demoColors.white,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    color: demoColors.mutedText,
    fontSize: 14,
  },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: demoColors.inputOutline,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    color: demoColors.text,
    fontSize: 16,
    backgroundColor: demoColors.white,
  },
  switchRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    color: demoColors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  sheetActions: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  sheetActionButton: {
    minWidth: 86,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: demoColors.background,
    borderRadius: 20,
    backgroundColor: demoColors.text,
    paddingHorizontal: spacing.sm,
  },
  cancelButton: {
    borderColor: demoColors.text,
    backgroundColor: demoColors.white,
  },
  cancelButtonText: {
    color: demoColors.text,
    fontSize: 16,
  },
  saveButtonText: {
    color: demoColors.background,
    fontSize: 16,
  },
});
