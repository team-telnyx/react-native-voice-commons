import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { TelnyxEnvironment } from '../react-voice-commons-sdk/src';
import { demoColors, radii, spacing } from './demoTheme';

interface DeveloperOptionsSheetProps {
  visible: boolean;
  environment: TelnyxEnvironment;
  canChangeEnvironment: boolean;
  canForceIceRestart: boolean;
  onClose: () => void;
  onSelectEnvironment: (environment: TelnyxEnvironment) => void;
  onForceIceRestart: () => void;
}

interface OptionRowProps {
  title: string;
  subtitle?: string;
  selected?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  onPress: () => void;
  testID?: string;
}

const OptionRow: React.FC<OptionRowProps> = ({
  title,
  subtitle,
  selected = false,
  disabled = false,
  destructive = false,
  onPress,
  testID,
}) => (
  <TouchableOpacity
    style={[styles.option, disabled && styles.optionDisabled]}
    disabled={disabled}
    onPress={onPress}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityState={{ disabled, selected }}
    testID={testID}
  >
    <View style={styles.optionCopy}>
      <Text style={[styles.optionTitle, destructive && styles.destructiveText]}>{title}</Text>
      {subtitle ? <Text style={styles.optionSubtitle}>{subtitle}</Text> : null}
    </View>
    {selected ? <Text style={styles.checkmark}>✓</Text> : null}
  </TouchableOpacity>
);

export const DeveloperOptionsSheet: React.FC<DeveloperOptionsSheetProps> = ({
  visible,
  environment,
  canChangeEnvironment,
  canForceIceRestart,
  onClose,
  onSelectEnvironment,
  onForceIceRestart,
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" />
      <View style={styles.sheet} testID="developerOptionsSheet">
        <View style={styles.handle} />
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Developer options</Text>
            <Text style={styles.subtitle}>Connection and recovery testing</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close developer options"
            testID="closeDeveloperOptions"
          >
            <Text style={styles.close}>Close</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>SIGNALING ENVIRONMENT</Text>
        <View style={styles.group}>
          <OptionRow
            title="Production"
            subtitle="rtc.telnyx.com"
            selected={environment === 'production'}
            disabled={!canChangeEnvironment}
            onPress={() => onSelectEnvironment('production')}
            testID="productionEnvironmentOption"
          />
          <View style={styles.divider} />
          <OptionRow
            title="Development"
            subtitle="rtcdev.telnyx.com"
            selected={environment === 'development'}
            disabled={!canChangeEnvironment}
            onPress={() => onSelectEnvironment('development')}
            testID="developmentEnvironmentOption"
          />
        </View>
        {!canChangeEnvironment ? (
          <Text style={styles.helpText}>Disconnect before changing the environment.</Text>
        ) : null}

        <Text style={styles.sectionLabel}>ACTIVE CALL TESTING</Text>
        <View style={styles.group}>
          <OptionRow
            title="Force ICE restart"
            subtitle={
              canForceIceRestart
                ? 'Inject an ICE failure and start recovery'
                : 'Available while a call is active'
            }
            destructive
            disabled={!canForceIceRestart}
            onPress={onForceIceRestart}
            testID="forceIceRestartOption"
          />
        </View>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  sheet: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: demoColors.background,
  },
  handle: {
    width: 40,
    height: 4,
    alignSelf: 'center',
    borderRadius: radii.pill,
    backgroundColor: demoColors.disabled,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: demoColors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: spacing.xs,
    color: demoColors.mutedText,
    fontSize: 14,
  },
  close: {
    color: demoColors.selectedGreen,
    fontSize: 16,
    fontWeight: '600',
  },
  sectionLabel: {
    marginTop: spacing.xs,
    color: demoColors.mutedText,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  group: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: demoColors.secondary,
    borderRadius: radii.md,
    backgroundColor: demoColors.white,
  },
  option: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionDisabled: {
    opacity: 0.45,
  },
  optionCopy: {
    flex: 1,
  },
  optionTitle: {
    color: demoColors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  optionSubtitle: {
    marginTop: 3,
    color: demoColors.mutedText,
    fontSize: 13,
  },
  destructiveText: {
    color: demoColors.danger,
  },
  checkmark: {
    marginLeft: spacing.md,
    color: demoColors.selectedGreen,
    fontSize: 22,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.md,
    backgroundColor: demoColors.secondary,
  },
  helpText: {
    marginTop: -spacing.xs,
    color: demoColors.mutedText,
    fontSize: 13,
  },
});
