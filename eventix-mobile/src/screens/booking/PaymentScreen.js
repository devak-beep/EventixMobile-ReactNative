import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, font, radius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import Button from '../../components/Button';
import { createRazorpayOrder, verifyRazorpayPayment } from '../../api';
import RazorpayCheckout from 'react-native-razorpay';

const RAZORPAY_KEY = 'rzp_test_SHAhOPLrcvfFUi';

export default function PaymentScreen({ route, navigation }) {
  const { bookingId, event, amount } = route.params;
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    setLoading(true);
    try {
      const orderRes = await createRazorpayOrder({ bookingId, amount: amount * 100, currency: 'INR' });
      const options = {
        description: `Booking for ${event.name}`,
        currency: 'INR',
        key: RAZORPAY_KEY,
        amount: amount * 100,
        order_id: orderRes.data?.orderId || orderRes.orderId,
        name: 'Eventix',
        theme: { color: '#0ea5e9' },
      };
      const paymentData = await RazorpayCheckout.open(options);
      await verifyRazorpayPayment({ bookingId, razorpay_order_id: paymentData.razorpay_order_id, razorpay_payment_id: paymentData.razorpay_payment_id, razorpay_signature: paymentData.razorpay_signature });
      navigation.replace('BookingSuccess', { bookingId, event, amount });
    } catch (err) {
      if (err.code !== 2) Alert.alert('Payment Failed', err.description || err.response?.data?.error || 'Payment could not be processed');
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.title, { color: theme.text }]}>Complete Payment</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.cardLabel, { color: theme.textMuted }]}>Booking for</Text>
          <Text style={[styles.cardEvent, { color: theme.text }]}>{event.name}</Text>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.amountRow}>
            <Text style={[styles.amountLabel, { color: theme.textMuted }]}>Total Amount</Text>
            <Text style={[styles.amountVal, { color: theme.primary }]}>₹{amount}</Text>
          </View>
        </View>
        <View style={[styles.secureNote, { backgroundColor: theme.success + '11', borderColor: theme.success + '33' }]}>
          <Text style={[styles.secureText, { color: theme.success }]}>Payments secured via Razorpay. Your card details are never stored.</Text>
        </View>
        <Button title={`Pay ₹${amount} with Razorpay`} onPress={handlePay} loading={loading} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },
  title: { fontSize: font.xxl, fontWeight: '800' },
  card: { borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1 },
  cardLabel: { fontSize: font.sm },
  cardEvent: { fontSize: font.lg, fontWeight: '700', marginTop: spacing.xs },
  divider: { height: 1, marginVertical: spacing.md },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amountLabel: { fontSize: font.md },
  amountVal: { fontSize: font.xxl, fontWeight: '800' },
  secureNote: { borderRadius: radius.md, padding: spacing.md, borderWidth: 1 },
  secureText: { fontSize: font.sm, lineHeight: 20 },
});
