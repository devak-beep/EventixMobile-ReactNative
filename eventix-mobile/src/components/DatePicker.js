import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import RNDateTimePicker from '@react-native-community/datetimepicker';
import { font, radius, spacing } from '../theme';

// Format date in LOCAL time (avoids UTC timezone shift)
const toLocalISO = (date) => {
  const p = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
};

export default function DatePicker({ label, value, onChange, mode = 'datetime', minimumDate, theme }) {
  const [show, setShow] = useState(false);
  const [pickerMode, setPickerMode] = useState('date');

  const date = value ? new Date(value) : new Date();

  const handleChange = (event, selected) => {
    if (event.type === 'dismissed') { setShow(false); return; }
    if (!selected) { setShow(false); return; }

    if (mode === 'datetime' && pickerMode === 'date') {
      // Keep existing time, update date part only, then show time picker
      const existing = value ? new Date(value) : new Date();
      selected.setHours(existing.getHours(), existing.getMinutes());
      onChange(toLocalISO(selected));
      setPickerMode('time');
    } else {
      const d = value ? new Date(value) : new Date();
      if (pickerMode === 'time') {
        d.setHours(selected.getHours(), selected.getMinutes());
      } else {
        d.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      }
      onChange(toLocalISO(d));
      setShow(false);
      setPickerMode('date');
    }
  };

  const display = value
    ? mode === 'datetime'
      ? new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Select date...';

  return (
    <View style={styles.wrap}>
      {label && <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>}
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
        onPress={() => { setPickerMode('date'); setShow(true); }}
      >
        <Text style={{ color: value ? theme.text : theme.textMuted, fontSize: font.md }}>📅  {display}</Text>
      </TouchableOpacity>
      {show && (
        <RNDateTimePicker
          value={date}
          mode={pickerMode}
          display="default"
          minimumDate={minimumDate}
          onChange={handleChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { fontSize: font.sm, fontWeight: '600', marginBottom: 6 },
  btn: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12 },
});
