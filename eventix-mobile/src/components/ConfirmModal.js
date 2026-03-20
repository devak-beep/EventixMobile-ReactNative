import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { spacing, font, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import Button from './Button';

export default function ConfirmModal({ visible, title, message, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel', type = 'default' }) {
  const { theme } = useTheme();
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.box, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.message, { color: theme.textMuted }]}>{message}</Text>
          <View style={styles.row}>
            <Button title={cancelText} onPress={onCancel} variant="outline" style={styles.btn} />
            <Button title={confirmText} onPress={onConfirm} variant={type === 'danger' ? 'danger' : 'primary'} style={styles.btn} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  box: { borderRadius: radius.lg, padding: spacing.lg, width: '100%', borderWidth: 1 },
  title: { fontSize: font.xl, fontWeight: '700', marginBottom: spacing.sm },
  message: { fontSize: font.md, marginBottom: spacing.lg, lineHeight: 22 },
  row: { flexDirection: 'row', gap: spacing.sm },
  btn: { flex: 1 },
});
