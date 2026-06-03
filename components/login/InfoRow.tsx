import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { demoColors, spacing } from '../demoTheme';

type InfoRowProps = {
  label: string;
  testID?: string;
  children: React.ReactNode;
};

export function InfoRow({ label, testID, children }: InfoRowProps) {
  return (
    <View style={styles.section} testID={testID}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValueRow}>{children}</View>
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
  infoValueRow: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
