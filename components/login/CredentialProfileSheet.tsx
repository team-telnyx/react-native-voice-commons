import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import { demoColors, radii, spacing } from '../demoTheme';
import { LabeledInput } from './LabeledInput';
import { SavedProfile, profileKey } from './profileTypes';

type CredentialProfileSheetProps = {
  visible: boolean;
  profiles: SavedProfile[];
  selectedProfile: SavedProfile | null;
  draftProfile: SavedProfile;
  setDraftProfile: React.Dispatch<React.SetStateAction<SavedProfile>>;
  setSelectedProfile: React.Dispatch<React.SetStateAction<SavedProfile | null>>;
  onEditProfile: (profile: SavedProfile | null) => void;
  onDeleteProfile: (profile: SavedProfile) => void;
  onSave: () => Promise<boolean>;
  onConfirm: () => void;
  onCancel: () => void;
};

export function CredentialProfileSheet({
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
                              onPress={() => onDeleteProfile(nextProfile)}
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

const styles = StyleSheet.create({
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
  infoValue: {
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
