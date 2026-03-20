import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, font, radius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import Button from '../../components/Button';
import ConfirmModal from '../../components/ConfirmModal';
import { confirmBooking, cancelLock } from '../../api';

export default function ConfirmBookingScreen({ route, navigation }) {
  const { lockId, event, seatCount, passType, selectedDate, amount } = route.params;
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await confirmBooking(lockId);
      const bookingId = res.booking?._id || res.data?._id;
      navigation.replace('Payment', { bookingId, event, amount });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to confirm booking');
    } finally { setLoading(false); }
  };

  const handleCancel = async () => {
    setCancelModal(false);
    try { await cancelLock(lockId); } catch (_) {}
    navigation.goBack();
  };

  const rows = [
    ['Event', event.name],
    ['Date', new Date(event.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })],
    ['Seats', seatCount],
    ...(passType !== 'regular' ? [['Pass Type', passType === 'season' ? 'Season Pass' : 'Daily Pass']] : []),
    ...(selectedDate ? [['Selected Date', new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })]] : []),
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.title, { color: theme.text }]}>Confirm Booking</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>Review details before proceeding to payment</Text>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.row}>
              <Text style={[styles.rowLabel, { color: theme.textMuted }]}>{label}</Text>
              <Text style={[styles.rowValue, { color: theme.text }]} numberOfLines={2}>{value}</Text>
            </View>
          ))}
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: theme.textMuted }]}>Total Amount</Text>
            <Text style={[styles.totalVal, { color: theme.primary }]}>₹{amount}</Text>
          </View>
        </View>

        <View style={[styles.notice, { backgroundColor: theme.warning + '18', borderColor: theme.warning + '44' }]}>
          <Text style={[styles.noticeText, { color: theme.warning }]}>Seats are locked for 5 minutes. Complete payment before they expire.</Text>
        </View>

        <Button title="Proceed to Payment" onPress={handleConfirm} loading={loading} />
        <Button title="Cancel" onPress={() => setCancelModal(true)} variant="outline" style={styles.cancelBtn} />
      </ScrollView>
      <ConfirmModal visible={cancelModal} title="Cancel Booking" message="Your locked seats will be released." onConfirm={handleCancel} onCancel={() => setCancelModal(false)} confirmText="Yes, Cancel" type="danger" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },
  title: { fontSize: font.xxl, fontWeight: '800' },
  subtitle: { fontSize: font.md },
  card: { borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rowLabel: { fontSize: font.md, flex: 1 },
  rowValue: { fontSize: font.md, fontWeight: '600', flex: 1, textAlign: 'right' },
  totalVal: { fontSize: font.xl, fontWeight: '800' },
  divider: { height: 1, marginVertical: spacing.xs },
  notice: { borderRadius: radius.md, padding: spacing.md, borderWidth: 1 },
  noticeText: { fontSize: font.sm, lineHeight: 20 },
  cancelBtn: { marginTop: -spacing.sm },
});
