import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { demoColors, radii, spacing } from '../demoTheme';

type LabeledInputProps = React.ComponentProps<typeof TextInput> & {
  label: string;
};

export function LabeledInput({ label, style, ...props }: LabeledInputProps) {
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
});
