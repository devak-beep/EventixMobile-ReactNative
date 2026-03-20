import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, font, radius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import Button from '../../components/Button';
import { lockSeats, getEventById } from '../../api';
import { useAuth } from '../../context/AuthContext';

export default function LockSeatsScreen({ route, navigation }) {
  const { event: initialEvent } = route.params;
  const { user } = useAuth();
  const { theme } = useTheme();
  const [event, setEvent] = useState(initialEvent);
  const [seatCount, setSeatCount] = useState(1);
  const [passType, setPassType] = useState('regular');
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(false);

  // Refresh event to get latest seat counts
  useEffect(() => {
    getEventById(initialEvent._id).then(r => setEvent(r.data)).catch(() => {});
  }, [initialEvent._id]);

  const isMultiDay = event.eventType === 'multi-day';
  const maxSeats = Math.min(event.availableSeats || 0, 10);

  const getDates = () => {
    if (!isMultiDay || !event.endDate) return [];
    const dates = [];
    const end = new Date(event.endDate);
    for (let d = new Date(event.eventDate); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d).toISOString().split('T')[0]);
    }
    return dates;
  };

  const pricePerSeat = () => {
    if (isMultiDay && passType === 'season') return event.passOptions?.seasonPass?.price ?? event.amount;
    if (isMultiDay && passType === 'daily') return event.passOptions?.dailyPass?.price ?? event.amount;
    return event.amount;
  };

  const totalAmount = () => pricePerSeat() * seatCount;

  const handleLock = async () => {
    if (event.availableSeats < seatCount) return Alert.alert('Error', 'Not enough seats available');
    if (isMultiDay && passType === 'daily' && !selectedDate) return Alert.alert('Error', 'Please select a date for daily pass');
    setLoading(true);
    try {
      const idempotencyKey = `${user._id}-${event._id}-${Date.now()}`;
      const body = { seats: seatCount, userId: user._id, idempotencyKey, passType };
      if (selectedDate) body.selectedDate = selectedDate;
      const res = await lockSeats(event._id, body);
      const lockId = res.lock?._id || res.data?._id || res._id;
      if (!lockId) throw new Error('No lock ID returned');
      navigation.navigate('ConfirmBooking', { lockId, event, seatCount, passType, selectedDate, amount: totalAmount() });
    } catch (err) {
      Alert.alert('Failed to Lock Seats', err.response?.data?.error || err.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const dates = getDates();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.eventInfo, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.eventName, { color: theme.text }]}>{event.name}</Text>
          <Text style={[styles.eventDate, { color: theme.accent }]}>
            {new Date(event.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
          <Text style={[styles.seatsAvail, { color: theme.textMuted }]}>{event.availableSeats} seats available</Text>
        </View>

        {isMultiDay && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Pass Type</Text>
            <View style={styles.passRow}>
              {event.passOptions?.dailyPass?.enabled && (
                <TouchableOpacity style={[styles.passBtn, { borderColor: passType === 'daily' ? theme.primary : theme.border, backgroundColor: passType === 'daily' ? theme.primary + '22' : theme.card }]} onPress={() => setPassType('daily')}>
                  <Text style={[styles.passBtnText, { color: passType === 'daily' ? theme.primary : theme.textMuted }]}>Daily Pass</Text>
                  <Text style={[styles.passBtnPrice, { color: passType === 'daily' ? theme.primary : theme.textMuted }]}>₹{event.passOptions.dailyPass.price}</Text>
                </TouchableOpacity>
              )}
              {event.passOptions?.seasonPass?.enabled && (
                <TouchableOpacity style={[styles.passBtn, { borderColor: passType === 'season' ? theme.primary : theme.border, backgroundColor: passType === 'season' ? theme.primary + '22' : theme.card }]} onPress={() => setPassType('season')}>
                  <Text style={[styles.passBtnText, { color: passType === 'season' ? theme.primary : theme.textMuted }]}>Season Pass</Text>
                  <Text style={[styles.passBtnPrice, { color: passType === 'season' ? theme.primary : theme.textMuted }]}>₹{event.passOptions.seasonPass.price}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {isMultiDay && passType === 'daily' && dates.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Select Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {dates.map(d => (
                <TouchableOpacity key={d} style={[styles.dateChip, { backgroundColor: selectedDate === d ? theme.primary : theme.card, borderColor: selectedDate === d ? theme.primary : theme.border }]} onPress={() => setSelectedDate(d)}>
                  <Text style={[styles.dateChipText, { color: selectedDate === d ? theme.white : theme.textMuted }]}>
                    {new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Number of Seats</Text>
          <View style={styles.counterRow}>
            <TouchableOpacity style={[styles.counterBtn, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setSeatCount(c => Math.max(1, c - 1))}>
              <Text style={[styles.counterBtnText, { color: theme.text }]}>−</Text>
            </TouchableOpacity>
            <Text style={[styles.counterVal, { color: theme.text }]}>{seatCount}</Text>
            <TouchableOpacity style={[styles.counterBtn, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setSeatCount(c => Math.min(maxSeats, c + 1))}>
              <Text style={[styles.counterBtnText, { color: theme.text }]}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.maxNote, { color: theme.textMuted }]}>Max {maxSeats} seats per booking</Text>
        </View>

        <View style={[styles.summary, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <SummaryRow label="Price per seat" value={`₹${pricePerSeat()}`} theme={theme} />
          <SummaryRow label="Seats" value={`× ${seatCount}`} theme={theme} />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <SummaryRow label="Total" value={`₹${totalAmount()}`} theme={theme} highlight />
        </View>

        <Button title="Lock Seats & Continue" onPress={handleLock} loading={loading} disabled={maxSeats === 0} />
        <Text style={[styles.lockNote, { color: theme.textMuted }]}>Seats are locked for 5 minutes</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value, theme, highlight }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.summaryVal, { color: highlight ? theme.primary : theme.text, fontSize: highlight ? font.lg : font.md, fontWeight: highlight ? '800' : '600' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },
  eventInfo: { borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, gap: spacing.xs },
  eventName: { fontSize: font.lg, fontWeight: '700' },
  eventDate: { fontSize: font.sm },
  seatsAvail: { fontSize: font.sm },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: font.md, fontWeight: '700' },
  passRow: { flexDirection: 'row', gap: spacing.sm },
  passBtn: { flex: 1, padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center' },
  passBtnText: { fontWeight: '600', fontSize: font.md },
  passBtnPrice: { fontSize: font.sm, marginTop: 2 },
  dateChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1 },
  dateChipText: { fontWeight: '600', fontSize: font.sm },
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  counterBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  counterBtnText: { fontSize: font.xl, fontWeight: '700' },
  counterVal: { fontSize: font.xxl, fontWeight: '800', minWidth: 40, textAlign: 'center' },
  maxNote: { fontSize: font.sm, textAlign: 'center' },
  summary: { borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: font.md },
  summaryVal: {},
  divider: { height: 1, marginVertical: spacing.xs },
  lockNote: { fontSize: font.sm, textAlign: 'center' },
});
