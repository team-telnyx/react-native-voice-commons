import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { demoColors, spacing } from '../demoTheme';

type ProfileSwitcherProps = {
  profileName: string;
  onPress: () => void;
};

export function ProfileSwitcher({ profileName, onPress }: ProfileSwitcherProps) {
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

const styles = StyleSheet.create({
  section: {
    gap: 4,
  },
  infoLabel: {
    color: demoColors.text,
    fontSize: 14,
  },
  infoValue: {
    color: demoColors.text,
    fontSize: 14,
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
});
