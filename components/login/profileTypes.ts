export type LoginMode = 'credentials' | 'token';

export type SavedProfile = {
  id: string;
  loginMode: LoginMode;
  sipUsername: string;
  sipPassword: string;
  sipToken: string;
  callerIdName: string;
  callerIdNumber: string;
  forceRelayCandidate: boolean;
};

export const emptyProfile: SavedProfile = {
  id: '',
  loginMode: 'credentials',
  sipUsername: '',
  sipPassword: '',
  sipToken: '',
  callerIdName: '',
  callerIdNumber: '',
  forceRelayCandidate: false,
};

export function createProfileId() {
  return `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function withProfileId(profile: SavedProfile): SavedProfile {
  return profile.id ? profile : { ...profile, id: createProfileId() };
}

export function legacyProfileKey(profile: SavedProfile) {
  return `${profile.loginMode}:${profile.callerIdName}:${profile.loginMode === 'token' ? profile.sipToken : profile.sipUsername}`;
}

export function profileKey(profile: SavedProfile) {
  return profile.id || legacyProfileKey(profile);
}

export function upsertProfile(
  currentProfiles: SavedProfile[],
  nextProfile: SavedProfile,
  originalProfileKey?: string | null
) {
  const profileWithId = withProfileId(nextProfile);
  const nextKey = profileKey(profileWithId);
  const existingIndex = currentProfiles.findIndex(
    (item) => profileKey(item) === (originalProfileKey || nextKey)
  );

  if (existingIndex === -1) {
    return [...currentProfiles, profileWithId];
  }

  return currentProfiles.map((item, index) => (index === existingIndex ? profileWithId : item));
}
