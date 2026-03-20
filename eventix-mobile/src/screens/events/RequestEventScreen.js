import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { spacing, font, radius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import Input from '../../components/Input';
import Button from '../../components/Button';
import DatePicker from '../../components/DatePicker';
import { submitEventRequest } from '../../api';
import { useAuth } from '../../context/AuthContext';

const MULTI_CATS = [
  { value: 'food-drink', label: '🍔 Food & Drink' },
  { value: 'festivals-cultural', label: '🎊 Festivals & Cultural' },
  { value: 'dance-party', label: '💃 Dance & Party' },
];
const SINGLE_CATS = [
  { value: 'concerts-music', label: '🎵 Concerts & Music' },
  { value: 'sports-live', label: '⚽ Sports & Live' },
  { value: 'arts-theater', label: '🎭 Arts & Theater' },
  { value: 'comedy-standup', label: '😂 Comedy & Stand-up' },
  { value: 'movies-premieres', label: '🎬 Movies & Premieres' },
];
const MULTI_VALUES = MULTI_CATS.map(c => c.value);

export default function RequestEventScreen({ navigation }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [form, setForm] = useState({
    name: '', description: '', eventDate: '', endDate: '',
    eventType: 'single-day', totalSeats: '', type: 'public',
    category: [], amount: '',
    passOptions: { dailyPass: { enabled: false, price: '' }, seasonPass: { enabled: false, price: '' } },
    image: null,
  });
  const [loading, setLoading] = useState(false);
  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }));
  const isMultiDay = form.eventType === 'multi-day';

  const toggleMultiCat = (cat) => {
    setForm(f => {
      const withoutSingle = f.category.filter(c => MULTI_VALUES.includes(c));
      return { ...f, category: withoutSingle.includes(cat) ? withoutSingle.filter(c => c !== cat) : [...withoutSingle, cat] };
    });
  };

  const selectSingleCat = (cat) => {
    setForm(f => ({ ...f, category: f.category.includes(cat) ? [] : [cat] }));
  };

  const setPass = (key, field, val) => setForm(f => ({
    ...f, passOptions: { ...f.passOptions, [key]: { ...f.passOptions[key], [field]: val } }
  }));

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7, allowsEditing: true, aspect: [16, 9] });
    if (!result.canceled) set('image')(`data:image/jpeg;base64,${result.assets[0].base64}`);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.eventDate || !form.totalSeats) return Alert.alert('Error', 'Fill all required fields');
    if (form.category.length === 0) return Alert.alert('Error', 'Select at least one category');
    if (isMultiDay && !form.endDate) return Alert.alert('Error', 'End date is required for multi-day events');
    if (isMultiDay && !form.passOptions.dailyPass.enabled && !form.passOptions.seasonPass.enabled)
      return Alert.alert('Error', 'Enable at least one pass option');

    setLoading(true);
    try {
      const payload = {
        name: form.name, description: form.description, eventDate: form.eventDate,
        eventType: form.eventType, totalSeats: parseInt(form.totalSeats),
        type: form.type, category: form.category, image: form.image, userId: user._id,
      };
      if (isMultiDay) { payload.endDate = form.endDate; payload.passOptions = form.passOptions; }
      else { payload.amount = parseFloat(form.amount) || 0; }

      await submitEventRequest({ ...payload, userId: user._id, userRole: user.role });
      Alert.alert('Submitted!', 'Your event request has been submitted for review.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to submit');
    } finally { setLoading(false); }
  };

  const activeSingle = form.category.find(c => SINGLE_CATS.map(s => s.value).includes(c));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        <View style={[styles.infoBox, { backgroundColor: theme.primary + '11', borderColor: theme.primary + '33' }]}>
          <Text style={[styles.infoText, { color: theme.primary }]}>Submit a request to host your event. Once approved, pay ₹5000 platform fee to publish.</Text>
        </View>

        <Input label="Event Name *" value={form.name} onChangeText={set('name')} placeholder="e.g. Jazz Night" />
        <Input label="Description" value={form.description} onChangeText={set('description')} placeholder="Tell us about your event..." multiline numberOfLines={3} inputStyle={{ minHeight: 80, textAlignVertical: 'top' }} />

        {/* Single / Multi-day toggle */}
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
        <Text style={[styles.label, { color: theme.textMuted }]}>Categories (Multi-select)</Text>
        <View style={styles.catGrid}>
          {MULTI_CATS.map(({ value, label }) => {
            const active = form.category.includes(value);
            return (
              <TouchableOpacity key={value} style={[styles.catChip, { backgroundColor: active ? theme.primary + '22' : theme.card, borderColor: active ? theme.primary : theme.border }]} onPress={() => toggleMultiCat(value)}>
                <View style={[styles.checkbox, { borderColor: active ? theme.primary : theme.border, backgroundColor: active ? theme.primary : 'transparent' }]}>
                  {active && <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>✓</Text>}
                </View>
                <Text style={[styles.catText, { color: active ? theme.primary : theme.textMuted }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={[styles.label, { color: theme.textMuted }]}>Or select single category</Text>
        <View style={styles.catGrid}>
          {SINGLE_CATS.map(({ value, label }) => {
            const active = activeSingle === value;
            return (
              <TouchableOpacity key={value} style={[styles.catChip, { backgroundColor: active ? theme.primary + '22' : theme.card, borderColor: active ? theme.primary : theme.border }]} onPress={() => selectSingleCat(value)}>
                <Text style={[styles.catText, { color: active ? theme.primary : theme.textMuted }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Input label="Total Seats *" value={form.totalSeats} onChangeText={set('totalSeats')} keyboardType="number-pad" placeholder="50" />

        {/* Pricing */}
        {isMultiDay ? (
          <View style={[styles.passBox, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
            <Text style={[styles.label, { color: theme.textMuted, marginBottom: spacing.sm }]}>🎟️ Pass Options</Text>
            {/* Day Pass */}
            <View style={styles.passRow}>
              <Switch value={form.passOptions.dailyPass.enabled} onValueChange={v => setPass('dailyPass', 'enabled', v)} trackColor={{ true: theme.primary }} />
              <Text style={[styles.passLabel, { color: theme.text }]}>🎫 Day Pass</Text>
            </View>
            {form.passOptions.dailyPass.enabled && (
              <Input label="Price per day (₹)" value={form.passOptions.dailyPass.price} onChangeText={v => setPass('dailyPass', 'price', v)} keyboardType="decimal-pad" placeholder="500" />
            )}
            {/* Season Pass */}
            <View style={styles.passRow}>
              <Switch value={form.passOptions.seasonPass.enabled} onValueChange={v => setPass('seasonPass', 'enabled', v)} trackColor={{ true: theme.primary }} />
              <Text style={[styles.passLabel, { color: theme.text }]}>🌟 Season Pass</Text>
            </View>
            {form.passOptions.seasonPass.enabled && (
              <Input label="Full event price (₹)" value={form.passOptions.seasonPass.price} onChangeText={v => setPass('seasonPass', 'price', v)} keyboardType="decimal-pad" placeholder="1500" />
            )}
          </View>
        ) : (
          <Input label="Ticket Price (₹) *" value={form.amount} onChangeText={set('amount')} keyboardType="decimal-pad" placeholder="299 (0 for free)" />
        )}

        {/* Event Type */}
        <Text style={[styles.label, { color: theme.textMuted }]}>Event Visibility</Text>
        <View style={styles.toggleRow}>
          {[{ v: 'public', l: '🌍 Public' }, { v: 'private', l: '🔒 Private' }].map(({ v, l }) => (
            <TouchableOpacity key={v} style={[styles.toggleBtn, { borderColor: form.type === v ? theme.primary : theme.border, backgroundColor: form.type === v ? theme.primary + '18' : 'transparent' }]} onPress={() => set('type')(v)}>
              <Text style={[styles.toggleText, { color: form.type === v ? theme.primary : theme.textMuted }]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Image */}
        <Text style={[styles.label, { color: theme.textMuted }]}>Event Image</Text>
        <TouchableOpacity style={[styles.imgBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={pickImage}>
          <Text style={{ color: theme.primary, fontWeight: '600' }}>{form.image ? '✅ Image Selected — Tap to Change' : '📷 Upload Image'}</Text>
        </TouchableOpacity>

        <Button title="Submit Request" onPress={handleSubmit} loading={loading} style={{ marginTop: spacing.md }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  infoBox: { borderRadius: radius.md, padding: spacing.md, borderWidth: 1, marginBottom: spacing.lg },
  infoText: { fontSize: font.sm, lineHeight: 20 },
  label: { fontSize: font.sm, fontWeight: '600', marginBottom: spacing.sm },
  toggleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center' },
  toggleText: { fontWeight: '600', fontSize: font.sm },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1 },
  checkbox: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  catText: { fontSize: font.sm, fontWeight: '600' },
  passBox: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.md },
  passRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  passLabel: { fontSize: font.md, fontWeight: '600' },
  imgBtn: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginBottom: spacing.md, borderStyle: 'dashed' },
});
