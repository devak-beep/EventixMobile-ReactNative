import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, font, radius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import Input from '../../components/Input';
import Button from '../../components/Button';
import TracingBorder from '../../components/TracingBorder';
import { registerUser } from '../../api';

export default function RegisterScreen({ navigation }) {
  const { theme } = useTheme();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [loading, setLoading] = useState(false);
  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }));

  const handleRegister = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) return Alert.alert('Error', 'Fill all fields');
    setLoading(true);
    try {
      const res = await registerUser({ ...form, email: form.email.trim().toLowerCase() });
      if (res.requiresOtp) navigation.navigate('Otp', { email: form.email.trim().toLowerCase(), purpose: 'register' });
    } catch (err) {
      Alert.alert('Registration Failed', err.response?.data?.error || 'Something went wrong');
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, ...theme.shadow }]}>
          <TracingBorder color={theme.primary} />
          {/* Logo inside card like website */}
          <View style={styles.logoWrap}>
            <Image source={require('../../../assets/eventix-logo.png')} style={styles.logoImg} resizeMode="contain" />
            <Text style={[styles.appName, { color: theme.primary }]}>Eventix</Text>
            <Text style={[styles.tagline, { color: theme.textMuted }]}>Enterprise Event Management Platform</Text>
          </View>

          <Text style={[styles.title, { color: theme.text }]}>Create Account</Text>
          <Input label="Full Name" value={form.name} onChangeText={set('name')} placeholder="John Doe" />
          <Input label="Email" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" />
          <Input label="Password" value={form.password} onChangeText={set('password')} secureTextEntry placeholder="Enter your password" />

          <Text style={[styles.roleLabel, { color: theme.textMuted }]}>Register as</Text>
          <View style={styles.roleRow}>
            {['user', 'admin'].map(r => (
              <TouchableOpacity key={r} style={[styles.roleBtn, { borderColor: form.role === r ? theme.primary : theme.border, backgroundColor: form.role === r ? theme.primary + '22' : 'transparent' }]} onPress={() => set('role')(r)}>
                <Text style={[styles.roleBtnText, { color: form.role === r ? theme.primary : theme.textMuted }]}>{r.charAt(0).toUpperCase() + r.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Button title="Register" onPress={handleRegister} loading={loading} style={styles.btn} />

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.switchRow}>
            <Text style={[styles.switchText, { color: theme.textMuted }]}>
              Already have an account? <Text style={{ color: theme.primary, fontWeight: '700' }}>Login here</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  card: { borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, overflow: 'hidden' },
  logoWrap: { alignItems: 'center', marginBottom: spacing.lg },
  logoImg: { width: 72, height: 72 },
  appName: { fontSize: font.xxl, fontWeight: '800', marginTop: spacing.xs },
  tagline: { fontSize: font.sm, marginTop: 4, textAlign: 'center' },
  title: { fontSize: font.xl, fontWeight: '700', marginBottom: spacing.lg },
  roleLabel: { fontSize: font.sm, fontWeight: '600', marginBottom: spacing.sm },
  roleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  roleBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center' },
  roleBtnText: { fontWeight: '600' },
  btn: { marginTop: spacing.sm },
  switchRow: { alignItems: 'center', marginTop: spacing.lg },
  switchText: { fontSize: font.md },
});
