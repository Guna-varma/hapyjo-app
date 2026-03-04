import React from 'react';
import { View, Text, TextInput, TextInputProps, StyleSheet } from 'react-native';
import { modalStyles } from '@/components/ui/modalStyles';
import { colors } from '@/theme/tokens';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  /** Optional container style (e.g. marginBottom) */
  containerStyle?: object;
}

/**
 * Label + TextInput + optional error/hint. Uses modalStyles and tokens.
 */
export function Input({
  label,
  error,
  hint,
  containerStyle,
  placeholderTextColor = colors.placeholder,
  ...textInputProps
}: InputProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      {label != null && <Text style={modalStyles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={placeholderTextColor}
        style={[modalStyles.input, error != null && styles.inputError]}
        {...textInputProps}
      />
      {error != null && <Text style={styles.error}>{error}</Text>}
      {hint != null && error == null && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  inputError: {
    borderColor: colors.error,
  },
  error: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
});
