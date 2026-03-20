import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, font, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import Button from '../components/Button';
import ConfirmModal from '../components/ConfirmModal';
import { updateOtpPreference } from '../api';
import { useAuth } from '../context/AuthContext';

export default function SettingsScreen() {
  const { user, logout, updateUser } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const [otpEnabled, setOtpEnabled] = useState(user?.otpEnabled ?? true);
  const [logoutModal, setLogoutModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleOtpToggle = async (val) => {
    setOtpEnabled(val);
    setSaving(true);
    try {
      const res = await updateOtpPreference(user._id, val);
      await updateUser(res.data);
    } catch (err) {
      setOtpEnabled(!val);
      Alert.alert('Error', err.response?.data?.message || err.message || JSON.stringify(err));
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  const getRoleLabel = (role) => role === 'superAdmin' ? 'Super Admin' : role === 'admin' ? 'Admin' : 'User';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.profileCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
          </View>
          <Text style={[styles.name, { color: theme.text }]}>{user?.name}</Text>
          <Text style={[styles.email, { color: theme.textMuted }]}>{user?.email}</Text>
          <View style={[styles.roleBadge, { backgroundColor: theme.primary + '22' }]}>
            <Text style={[styles.roleText, { color: theme.primary }]}>{getRoleLabel(user?.role)}</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Appearance</Text>
        <View style={[styles.settingRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>Dark Mode</Text>
            <Text style={[styles.settingDesc, { color: theme.textMuted }]}>{isDark ? 'Currently using dark theme' : 'Currently using light theme'}</Text>
          </View>
          <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: theme.border, true: theme.primary }} thumbColor={theme.white} />
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Security</Text>
        <View style={[styles.settingRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>OTP on Login</Text>
            <Text style={[styles.settingDesc, { color: theme.textMuted }]}>Require email OTP every time you log in</Text>
          </View>
          <Switch value={otpEnabled} onValueChange={handleOtpToggle} disabled={saving} trackColor={{ false: theme.border, true: theme.primary }} thumbColor={theme.white} />
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Account</Text>
        <Button title="Logout" onPress={() => setLogoutModal(true)} variant="danger" />
      </ScrollView>

      <ConfirmModal
        visible={logoutModal}
        title="Logout"
        message="Are you sure you want to logout?"
        onConfirm={logout}
        onCancel={() => setLogoutModal(false)}
        confirmText="Logout"
        type="danger"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  profileCard: { borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', gap: spacing.sm, borderWidth: 1 },
  avatar: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: font.xl, fontWeight: '800' },
  name: { fontSize: font.xl, fontWeight: '700' },
  email: { fontSize: font.md },
  roleBadge: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full },
  roleText: { fontSize: font.sm, fontWeight: '700' },
  sectionTitle: { fontSize: font.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: spacing.sm },
  settingRow: { borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1 },
  settingInfo: { flex: 1, marginRight: spacing.md },
  settingLabel: { fontSize: font.md, fontWeight: '600' },
  settingDesc: { fontSize: font.sm, marginTop: 2 },
});
