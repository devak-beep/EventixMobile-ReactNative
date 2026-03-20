import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { radius, spacing, font } from '../theme';
import { useTheme } from '../context/ThemeContext';

const STATUS_COLORS = {
  CONFIRMED: '#10b981',
  PAYMENT_PENDING: '#f59e0b',
  INITIATED: '#0ea5e9',
  CANCELLED: '#ef4444',
  EXPIRED: '#94a3b8',
  FAILED: '#ef4444',
  PENDING: '#f59e0b',
  APPROVED: '#10b981',
  REJECTED: '#ef4444',
};

export default function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || '#94a3b8';
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
      <Text style={[styles.text, { color }]}>{status?.replace(/_/g, ' ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1, alignSelf: 'flex-start' },
  text: { fontSize: font.xs, fontWeight: '700' },
});
