import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
  Image, TouchableOpacity, Switch, TextInput, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { spacing, font, radius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import Input from '../../components/Input';
import Button from '../../components/Button';
import DatePicker from '../../components/DatePicker';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';

const MULTI_CATS = ['food-drink', 'festivals-cultural', 'dance-party'];
const SINGLE_CATS = [
  { value: 'concerts-music', label: '🎵 Concerts & Music' },
  { value: 'sports-live', label: '⚽ Sports & Live' },
  { value: 'arts-theater', label: '🎭 Arts & Theater' },
  { value: 'comedy-standup', label: '😂 Comedy & Stand-up' },
  { value: 'movies-premieres', label: '🎬 Movies & Premieres' },
];
const MULTI_CAT_LABELS = {
  'food-drink': '🍔 Food & Drink',
  'festivals-cultural': '🎊 Festivals & Cultural',
  'dance-party': '💃 Dance & Party',
};

const calcFee = (seats) => {
  const s = parseInt(seats) || 0;
  if (s <= 50) return 500;
  if (s <= 100) return 1000;
  if (s <= 200) return 1500;
  if (s <= 500) return 2500;
  if (s <= 1000) return 5000;
  if (s <= 2000) return 8000;
  if (s <= 5000) return 12000;
  if (s <= 10000) return 20000;
  return 35000;
};

export default function CreateEventScreen({ navigation }) {
  const { user } = useAuth();
  const { theme } = useTheme();

  const [form, setForm] = useState({
    name: '', description: '', eventDate: '', endDate: '',
    eventType: 'single-day', totalSeats: '10', type: 'public',
    category: [], amount: '0',
    passOptions: { dailyPass: { enabled: false, price: '' }, seasonPass: { enabled: false, price: '' } },
  });
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [createdEventId, setCreatedEventId] = useState('');

  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }));
  const isMultiDay = form.eventType === 'multi-day';
  const fee = calcFee(form.totalSeats);

  const toggleCategory = (cat) => {
    setForm(f => {
      if (MULTI_CATS.includes(cat)) {
        const filtered = f.category.filter(c => MULTI_CATS.includes(c));
        return { ...f, category: filtered.includes(cat) ? filtered.filter(c => c !== cat) : [...filtered, cat] };
      } else {
        const others = f.category.filter(c => MULTI_CATS.includes(c));
        return { ...f, category: [...others, cat] };
      }
    });
  };

  const setPassOption = (pass, field, val) => {
    setForm(f => ({ ...f, passOptions: { ...f.passOptions, [pass]: { ...f.passOptions[pass], [field]: val } } }));
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission needed', 'Allow photo access');
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });
    if (!result.canceled) setImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
  };

  const validate = () => {
    if (!form.name.trim()) return 'Event name is required';
    if (form.description.trim().length < 10) return 'Description must be at least 10 characters';
    if (!form.eventDate) return 'Event date is required';
    if (isMultiDay && !form.endDate) return 'End date is required for multi-day events';
    if (form.category.length === 0) return 'Select at least one category';
    if (!form.totalSeats || parseInt(form.totalSeats) < 1) return 'Total seats must be at least 1';
    if (isMultiDay && !form.passOptions.dailyPass.enabled && !form.passOptions.seasonPass.enabled)
      return 'Enable at least one pass option (Daily or Season)';
    return null;
  };

  const handleSubmit = () => {
    const err = validate();
    if (err) return Alert.alert('Validation Error', err);
    setPaymentModal(true);
  };

  const handlePayment = async () => {
    setPaymentModal(false);
    setLoading(true);
    try {
      const idempotencyKey = `${user._id}-${Date.now()}`;
      const payload = {
        name: form.name, description: form.description,
        eventDate: form.eventDate, eventType: form.eventType,
        totalSeats: parseInt(form.totalSeats), type: form.type,
        category: form.category, userId: user._id, userRole: user.role,
        idempotencyKey, image,
      };
      if (isMultiDay) {
        payload.endDate = form.endDate;
        payload.passOptions = {
          dailyPass: { enabled: form.passOptions.dailyPass.enabled, price: parseFloat(form.passOptions.dailyPass.price) || 0 },
          seasonPass: { enabled: form.passOptions.seasonPass.enabled, price: parseFloat(form.passOptions.seasonPass.price) || 0 },
        };
      } else {
        payload.amount = parseFloat(form.amount) || 0;
      }

      // Create order
      const orderRes = await api.post('/razorpay/create-event-order', { amount: fee, eventData: payload });
      const { orderId, keyId, amount: orderAmount, currency } = orderRes.data;

      // Import RazorpayCheckout
      const RazorpayCheckout = require('react-native-razorpay').default;
      const paymentData = await RazorpayCheckout.open({
        key: keyId, amount: orderAmount, currency, order_id: orderId,
        name: 'Eventix', description: `Event Creation Fee - ${form.name}`,
        theme: { color: '#0ea5e9' },
      });

      // Verify
      const verifyRes = await api.post('/razorpay/verify-event-payment', {
        razorpay_order_id: paymentData.razorpay_order_id,
        razorpay_payment_id: paymentData.razorpay_payment_id,
        razorpay_signature: paymentData.razorpay_signature,
        eventData: { ...payload, userRole: user.role },
      });

      if (verifyRes.data.success) {
        setCreatedEventId(verifyRes.data.event?.id || verifyRes.data.event?._id || '');
        setSuccessModal(true);
      }
    } catch (err) {
      if (err.code !== 2) Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to create event');
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Image picker */}
        <TouchableOpacity style={[styles.imagePicker, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={pickImage}>
          {image ? <Image source={{ uri: image }} style={styles.imagePreview} /> : (
            <View style={styles.imagePlaceholder}>
              <Text style={[styles.imageIcon, { color: theme.primary }]}>+</Text>
              <Text style={[styles.imageText, { color: theme.textMuted }]}>Add event image (max 5MB)</Text>
            </View>
          )}
        </TouchableOpacity>

        <Input label="Event Name *" value={form.name} onChangeText={set('name')} placeholder="e.g. Rock Concert 2024" />

        {/* Description with char count */}
        <View style={styles.descWrap}>
          <Text style={[styles.label, { color: theme.textMuted }]}>Description *</Text>
          <TextInput
            style={[styles.descInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
            value={form.description} onChangeText={set('description')}
            placeholder="Describe your event..." placeholderTextColor={theme.textMuted}
            multiline numberOfLines={4} maxLength={1500} textAlignVertical="top"
          />
          <Text style={[styles.charCount, { color: theme.textMuted }]}>{form.description.length}/1500</Text>
        </View>

        {/* Event Duration */}
        <Text style={[styles.label, { color: theme.textMuted }]}>Event Duration</Text>
        <View style={styles.toggleRow}>
          {[{ v: 'single-day', l: '🎯 Single Day' }, { v: 'multi-day', l: '📆 Multi-Day' }].map(({ v, l }) => (
            <TouchableOpacity key={v} style={[styles.toggleBtn, { borderColor: form.eventType === v ? theme.primary : theme.border, backgroundColor: form.eventType === v ? theme.primary + '18' : 'transparent' }]} onPress={() => set('eventType')(v)}>
              <Text style={[styles.toggleText, { color: form.eventType === v ? theme.primary : theme.textMuted }]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <DatePicker label={isMultiDay ? 'Start Date & Time *' : 'Event Date & Time *'} value={form.eventDate} onChange={set('eventDate')} mode="datetime" minimumDate={new Date()} theme={theme} />
        {isMultiDay && <DatePicker label="End Date *" value={form.endDate} onChange={set('endDate')} mode="date" minimumDate={form.eventDate ? new Date(form.eventDate) : new Date()} theme={theme} />}

        {/* Categories */}
        <Text style={[styles.label, { color: theme.textMuted }]}>Categories * (multi-select)</Text>
        <View style={styles.catGrid}>
          {MULTI_CATS.map(cat => (
            <TouchableOpacity key={cat} style={[styles.catChip, { backgroundColor: form.category.includes(cat) ? theme.primary : theme.card, borderColor: form.category.includes(cat) ? theme.primary : theme.border }]} onPress={() => toggleCategory(cat)}>
              <Text style={[styles.catText, { color: form.category.includes(cat) ? theme.white : theme.textMuted }]}>{MULTI_CAT_LABELS[cat]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.labelSm, { color: theme.textMuted }]}>Or single category:</Text>
        <View style={styles.catGrid}>
          {SINGLE_CATS.map(({ value, label }) => {
            const active = form.category.includes(value);
            return (
              <TouchableOpacity key={value} style={[styles.catChip, { backgroundColor: active ? theme.primary : theme.card, borderColor: active ? theme.primary : theme.border }]} onPress={() => toggleCategory(value)}>
                <Text style={[styles.catText, { color: active ? theme.white : theme.textMuted }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Seats */}
        <Input label="Total Seats *" value={form.totalSeats} onChangeText={set('totalSeats')} keyboardType="number-pad" placeholder="100" />
        {parseInt(form.totalSeats) > 0 && (
          <View style={[styles.feeNote, { backgroundColor: theme.primary + '11', borderColor: theme.primary + '33' }]}>
            <Text style={[styles.feeText, { color: theme.primary }]}>Platform fee: ₹{fee}</Text>
          </View>
        )}

        {/* Pricing */}
        {isMultiDay ? (
          <View style={[styles.passBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.passTitle, { color: theme.text }]}>🎟️ Pass Options</Text>
            {/* Daily Pass */}
            <View style={styles.passRow}>
              <View style={styles.passRowLeft}>
                <Text style={[styles.passName, { color: theme.text }]}>🎫 Daily Pass</Text>
                <Text style={[styles.passDesc, { color: theme.textMuted }]}>Price per single day</Text>
              </View>
              <Switch value={form.passOptions.dailyPass.enabled} onValueChange={v => setPassOption('dailyPass', 'enabled', v)} trackColor={{ false: theme.border, true: theme.primary }} thumbColor={theme.white} />
            </View>
            {form.passOptions.dailyPass.enabled && (
              <Input label="Daily Pass Price (₹)" value={form.passOptions.dailyPass.price} onChangeText={v => setPassOption('dailyPass', 'price', v)} keyboardType="decimal-pad" placeholder="500" style={{ marginTop: spacing.sm }} />
            )}
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            {/* Season Pass */}
            <View style={styles.passRow}>
              <View style={styles.passRowLeft}>
                <Text style={[styles.passName, { color: theme.text }]}>🏆 Season Pass</Text>
                <Text style={[styles.passDesc, { color: theme.textMuted }]}>One price for whole event</Text>
              </View>
              <Switch value={form.passOptions.seasonPass.enabled} onValueChange={v => setPassOption('seasonPass', 'enabled', v)} trackColor={{ false: theme.border, true: theme.primary }} thumbColor={theme.white} />
            </View>
            {form.passOptions.seasonPass.enabled && (
              <Input label="Season Pass Price (₹)" value={form.passOptions.seasonPass.price} onChangeText={v => setPassOption('seasonPass', 'price', v)} keyboardType="decimal-pad" placeholder="1500" style={{ marginTop: spacing.sm }} />
            )}
          </View>
        ) : (
          <Input label="Ticket Price (₹) *" value={form.amount} onChangeText={set('amount')} keyboardType="decimal-pad" placeholder="499" />
        )}

        {/* Visibility */}
        <Text style={[styles.label, { color: theme.textMuted }]}>Visibility</Text>
        <View style={styles.toggleRow}>
          {[{ v: 'public', l: '🌍 Public' }, { v: 'private', l: '🔒 Private' }].map(({ v, l }) => (
            <TouchableOpacity key={v} style={[styles.toggleBtn, { borderColor: form.type === v ? theme.primary : theme.border, backgroundColor: form.type === v ? theme.primary + '18' : 'transparent' }]} onPress={() => set('type')(v)}>
              <Text style={[styles.toggleText, { color: form.type === v ? theme.primary : theme.textMuted }]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.hint, { color: theme.textMuted }]}>Public events appear on home page. Private events can only be found by ID.</Text>

        <Button title="✨ Continue to Payment" onPress={handleSubmit} loading={loading} style={styles.btn} />
      </ScrollView>

      {/* Payment confirm modal */}
      <Modal transparent visible={paymentModal} animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Confirm Payment</Text>
            <Text style={[styles.modalDesc, { color: theme.textMuted }]}>Platform fee for creating this event:</Text>
            <Text style={[styles.feeAmount, { color: theme.primary }]}>₹{fee}</Text>
            <Text style={[styles.modalWarning, { color: theme.warning }]}>⚠️ Event will only be created after successful payment.</Text>
            <View style={styles.modalBtns}>
              <Button title="Cancel" onPress={() => setPaymentModal(false)} variant="outline" style={{ flex: 1 }} />
              <Button title="Pay & Create" onPress={handlePayment} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Success modal */}
      <Modal transparent visible={successModal} animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.success }]}>🎉 Event Created!</Text>
            <Text style={[styles.modalDesc, { color: theme.textMuted }]}>Your event has been created successfully. Share this ID for private access:</Text>
            <View style={[styles.idBox, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
              <Text style={[styles.idText, { color: theme.text }]} selectable>{createdEventId}</Text>
            </View>
            <Button title="Done" onPress={() => { setSuccessModal(false); navigation.goBack(); }} style={{ marginTop: spacing.md }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  imagePicker: { marginBottom: spacing.lg, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1.5, borderStyle: 'dashed' },
  imagePreview: { width: '100%', height: 180 },
  imagePlaceholder: { height: 120, justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  imageIcon: { fontSize: 32, fontWeight: '300' },
  imageText: { fontSize: font.sm },
  label: { fontSize: font.sm, fontWeight: '600', marginBottom: spacing.sm },
  labelSm: { fontSize: font.sm, marginBottom: spacing.sm, marginTop: spacing.sm },
  descWrap: { marginBottom: spacing.md },
  descInput: { borderRadius: radius.md, padding: spacing.md, fontSize: font.md, borderWidth: 1, minHeight: 100 },
  charCount: { fontSize: font.xs, textAlign: 'right', marginTop: spacing.xs },
  toggleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center' },
  toggleText: { fontWeight: '600', fontSize: font.sm },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  catChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1 },
  catText: { fontSize: font.sm, fontWeight: '600' },
  feeNote: { borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, marginBottom: spacing.md },
  feeText: { fontSize: font.sm, fontWeight: '700' },
  passBox: { borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, marginBottom: spacing.md, gap: spacing.sm },
  passTitle: { fontSize: font.md, fontWeight: '700', marginBottom: spacing.xs },
  passRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  passRowLeft: { flex: 1 },
  passName: { fontSize: font.md, fontWeight: '600' },
  passDesc: { fontSize: font.sm },
  divider: { height: 1, marginVertical: spacing.sm },
  hint: { fontSize: font.sm, marginBottom: spacing.lg, lineHeight: 18 },
  btn: { marginTop: spacing.sm },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.lg },
  modalBox: { borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, gap: spacing.sm },
  modalTitle: { fontSize: font.xl, fontWeight: '800' },
  modalDesc: { fontSize: font.md, lineHeight: 22 },
  feeAmount: { fontSize: font.xxxl, fontWeight: '800' },
  modalWarning: { fontSize: font.sm, lineHeight: 18 },
  modalBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  idBox: { borderRadius: radius.md, padding: spacing.md, borderWidth: 1 },
  idText: { fontSize: font.sm, fontFamily: 'monospace' },
});
