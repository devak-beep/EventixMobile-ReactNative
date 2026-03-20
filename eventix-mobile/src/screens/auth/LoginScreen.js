import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, font, radius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import Input from '../../components/Input';
import Button from '../../components/Button';
import TracingBorder from '../../components/TracingBorder';
import { loginUser } from '../../api';
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return Alert.alert('Error', 'Please fill all fields');
    setLoading(true);
    try {
      const res = await loginUser({ email: email.trim().toLowerCase(), password });
      if (res.requiresOtp) {
        navigation.navigate('Otp', { email: email.trim().toLowerCase(), purpose: 'login' });
      } else if (res.data) {
        await login(res.data);
      }
    } catch (err) {
      Alert.alert('Login Failed', err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, ...theme.shadow }]}>
          <TracingBorder color={theme.primary} />
          {/* Logo + title inside card like website */}
          <View style={styles.logoWrap}>
            <Image source={require('../../../assets/eventix-logo.png')} style={styles.logoImg} resizeMode="contain" />
            <Text style={[styles.appName, { color: theme.primary }]}>Eventix</Text>
            <Text style={[styles.tagline, { color: theme.textMuted }]}>Enterprise Event Management Platform</Text>
          </View>

          <Text style={[styles.title, { color: theme.text }]}>Welcome Back!</Text>
          <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="john@example.com" />
          <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Enter your password" />
          <Button title="Login" onPress={handleLogin} loading={loading} style={styles.btn} />

          <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.switchRow}>
            <Text style={[styles.switchText, { color: theme.textMuted }]}>
              Don't have an account? <Text style={[styles.switchLink, { color: theme.primary }]}>Register here</Text>
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
  btn: { marginTop: spacing.sm },
  switchRow: { alignItems: 'center', marginTop: spacing.lg },
  switchText: { fontSize: font.md },
  switchLink: { fontWeight: '700' },
});
