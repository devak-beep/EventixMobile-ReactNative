import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, font, radius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import Button from '../../components/Button';

export default function BookingSuccessScreen({ route, navigation }) {
  const { event, amount } = route.params || {};
  const { theme } = useTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
      <View style={styles.container}>
        <View style={[styles.iconCircle, { backgroundColor: theme.success + '22' }]}>
          <Text style={styles.checkmark}>✓</Text>
        </View>
        <Text style={[styles.title, { color: theme.text }]}>Booking Confirmed!</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>Your seats have been successfully booked.</Text>
        {event && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.eventName, { color: theme.text }]}>{event.name}</Text>
            <Text style={[styles.eventDate, { color: theme.primary }]}>{new Date(event.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
            {amount && <Text style={[styles.amount, { color: theme.success }]}>Paid: ₹{amount}</Text>}
          </View>
        )}
        <Button title="View My Bookings" onPress={() => navigation.getParent()?.navigate('BookingsTab')} style={styles.btn} />
        <Button title="Browse More Events" onPress={() => navigation.getParent()?.navigate('EventsTab')} variant="outline" style={styles.btn} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, gap: spacing.lg },
  iconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  checkmark: { fontSize: 40, color: '#10b981' },
  title: { fontSize: font.xxl, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: font.md, textAlign: 'center' },
  card: { borderRadius: radius.lg, padding: spacing.lg, width: '100%', alignItems: 'center', gap: spacing.xs, borderWidth: 1 },
  eventName: { fontSize: font.lg, fontWeight: '700', textAlign: 'center' },
  eventDate: { fontSize: font.md },
  amount: { fontSize: font.lg, fontWeight: '700', marginTop: spacing.xs },
  btn: { width: '100%' },
});
