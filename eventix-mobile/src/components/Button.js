import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { radius, font } from '../theme';

export default function Button({ title, onPress, loading, variant = 'primary', style, disabled }) {
  const { theme } = useTheme();

  const bg = variant === 'primary' ? theme.primary
    : variant === 'danger' ? theme.danger
    : variant === 'outline' ? 'transparent'
    : theme.card;

  const borderColor = variant === 'outline' ? theme.primary : 'transparent';
  const textColor = variant === 'outline' ? theme.primary : theme.white;

  return (
    <TouchableOpacity
      style={[styles.btn, { backgroundColor: bg, borderColor, borderWidth: variant === 'outline' ? 1.5 : 0 }, style, (disabled || loading) && styles.disabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator color={theme.white} size="small" />
        : <Text style={[styles.text, { color: textColor }]}>{title}</Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: font.md, fontWeight: '700', letterSpacing: 0.3 },
  disabled: { opacity: 0.5 },
});
