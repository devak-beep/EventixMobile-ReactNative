import React from 'react';
import { TextInput, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { radius, font, spacing } from '../theme';

export default function Input({ label, error, style, inputStyle, ...props }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.wrapper, style]}>
      {label && <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>}
      <TextInput
        style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: error ? theme.danger : theme.border }, inputStyle]}
        placeholderTextColor={theme.textMuted}
        {...props}
      />
      {error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: { fontSize: font.sm, marginBottom: spacing.xs, fontWeight: '600' },
  input: { borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 13, fontSize: font.md, borderWidth: 1 },
  error: { fontSize: font.sm, marginTop: spacing.xs },
});
