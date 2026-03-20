import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, font, radius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import Button from '../../components/Button';
import { verifyLoginOtp, verifyRegisterOtp, resendOtp } from '../../api';
import { useAuth } from '../../context/AuthContext';

const RESEND_COOLDOWN = 120;
const OTP_EXPIRY = 120;

export default function OtpScreen({ route, navigation }) {
  const { email, purpose } = route.params;
  const { login } = useAuth();
  const { theme } = useTheme();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const [otpExpiry, setOtpExpiry] = useState(OTP_EXPIRY);
  const [otpExpired, setOtpExpired] = useState(false);
  const inputs = useRef([]);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // OTP expiry countdown
  useEffect(() => {
    if (otpExpiry <= 0) { setOtpExpired(true); return; }
    const t = setTimeout(() => setOtpExpiry(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [otpExpiry]);

  const formatTime = (secs) => `${Math.floor(secs / 60).toString().padStart(2, '0')}:${(secs % 60).toString().padStart(2, '0')}`;

  const handleChange = (val, idx) => {
    const next = [...otp]; next[idx] = val.replace(/[^0-9]/g, ''); setOtp(next);
    if (val && idx < 5) inputs.current[idx + 1]?.focus();
  };
  const handleKeyPress = (e, idx) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[idx] && idx > 0) inputs.current[idx - 1]?.focus();
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) return Alert.alert('Error', 'Enter the 6-digit OTP');
    setLoading(true);
    try {
      const fn = purpose === 'login' ? verifyLoginOtp : verifyRegisterOtp;
      const res = await fn({ email, otp: code });
      if (res?.data) await login(res.data);
    } catch (err) {
      Alert.alert('Invalid OTP', err.response?.data?.error || 'OTP verification failed');
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await resendOtp({ email, purpose });
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
      setResendCooldown(RESEND_COOLDOWN);
      setOtpExpiry(OTP_EXPIRY);
      setOtpExpired(false);
      Alert.alert('Sent', 'New OTP sent to your email');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to resend');
    } finally { setResending(false); }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.text }]}>Verify Email</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          Enter the 6-digit OTP sent to{'\n'}
          <Text style={{ color: theme.primary, fontWeight: '700' }}>{email}</Text>
        </Text>

        {/* Expiry timer */}
        <Text style={[styles.timer, { color: otpExpired ? theme.error || '#e53e3e' : otpExpiry <= 30 ? '#e53e3e' : theme.textMuted }]}>
          {otpExpired ? '❌ OTP expired — resend a new one' : `⏱ OTP expires in ${formatTime(otpExpiry)}`}
        </Text>

        <View style={styles.otpRow}>
          {otp.map((digit, i) => (
            <TextInput key={i} ref={r => inputs.current[i] = r}
              style={[styles.otpInput, { backgroundColor: theme.inputBg, borderColor: digit ? theme.primary : theme.border, color: theme.text, opacity: otpExpired ? 0.4 : 1 }]}
              value={digit} onChangeText={v => handleChange(v, i)} onKeyPress={e => handleKeyPress(e, i)}
              keyboardType="number-pad" maxLength={1} textAlign="center" editable={!otpExpired} />
          ))}
        </View>

        <Button title="Verify OTP" onPress={handleVerify} loading={loading}
          disabled={otpExpired || otp.some(d => d === '')} style={styles.btn} />

        <TouchableOpacity
          onPress={handleResend}
          disabled={resending || resendCooldown > 0}
          style={styles.resendRow}>
          <Text style={[styles.resendText, { color: theme.textMuted }]}>
            Didn't receive?{' '}
            <Text style={{ color: resendCooldown > 0 ? theme.textMuted : theme.primary, fontWeight: '700' }}>
              {resending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
            </Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  title: { fontSize: font.xxl, fontWeight: '800', marginBottom: spacing.sm },
  subtitle: { fontSize: font.md, textAlign: 'center', marginBottom: spacing.md, lineHeight: 22 },
  timer: { fontSize: font.sm, marginBottom: spacing.xl, fontWeight: '600' },
  otpRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  otpInput: { width: 46, height: 56, borderRadius: radius.md, borderWidth: 1.5, fontSize: font.xl, fontWeight: '700' },
  btn: { width: '100%' },
  resendRow: { marginTop: spacing.lg },
  resendText: { fontSize: font.md },
});
