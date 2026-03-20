import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, font, radius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import Button from '../../components/Button';
import { getEventById } from '../../api';

export default function EventDetailScreen({ route, navigation }) {
  const { eventId } = route.params;
  const { theme } = useTheme();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEventById(eventId)
      .then(res => setEvent(res.data))
      .catch(() => Alert.alert('Error', 'Failed to load event'))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading || !event) return (
    <View style={[styles.center, { backgroundColor: theme.bg }]}>
      <Text style={[{ color: theme.textMuted, fontSize: font.lg }]}>{loading ? 'Loading...' : 'Event not found'}</Text>
    </View>
  );

  const isSoldOut = event.availableSeats === 0;
  const isMultiDay = event.eventType === 'multi-day';
  const organizer = event.createdBy?.name || event.createdBy || null;
  const approvedBy = event.approvedBy?.name || event.approvedBy || null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Hero image */}
        {event.image ? (
          <Image source={{ uri: event.image }} style={styles.image} />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: theme.bgSecondary }]}>
            <Text style={[styles.placeholderLetter, { color: theme.primary }]}>{event.name?.[0]?.toUpperCase()}</Text>
          </View>
        )}

        <View style={styles.body}>
          {/* Title + type badge */}
          <View style={styles.titleRow}>
            <Text style={[styles.name, { color: theme.text, flex: 1 }]}>{event.name}</Text>
            {event.type === 'private' && (
              <View style={[styles.typeBadge, { backgroundColor: theme.warning + '22', borderColor: theme.warning }]}>
                <Text style={[styles.typeBadgeText, { color: theme.warning }]}>PRIVATE</Text>
              </View>
            )}
          </View>

          {/* Date */}
          <Text style={[styles.date, { color: theme.primary }]}>
            {new Date(event.eventDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {isMultiDay && event.endDate ? ` – ${new Date(event.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}` : ''}
          </Text>

          {/* Stats row */}
          <View style={styles.statsRow}>
            {[
              ['₹' + event.amount, 'per seat'],
              [String(event.availableSeats), 'seats left'],
              [String(event.totalSeats), 'total'],
            ].map(([val, lbl]) => (
              <View key={lbl} style={[styles.statBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.statVal, { color: theme.primary }]}>{val}</Text>
                <Text style={[styles.statLabel, { color: theme.textMuted }]}>{lbl}</Text>
              </View>
            ))}
          </View>

          {/* Organizer / Approved by */}
          {(organizer || approvedBy) && (
            <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {organizer && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoIcon, { color: theme.primary }]}>👤</Text>
                  <View>
                    <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Organized by</Text>
                    <Text style={[styles.infoValue, { color: theme.text }]}>{organizer}</Text>
                  </View>
                </View>
              )}
              {approvedBy && (
                <View style={[styles.infoRow, organizer && { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: theme.border }]}>
                  <Text style={[styles.infoIcon, { color: theme.success }]}>✅</Text>
                  <View>
                    <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Approved by</Text>
                    <Text style={[styles.infoValue, { color: theme.text }]}>{approvedBy}</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Description */}
          {event.description ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>About</Text>
              <Text style={[styles.desc, { color: theme.textSecondary }]}>{event.description}</Text>
            </View>
          ) : null}

          {/* Pass options for multi-day */}
          {isMultiDay && (event.passOptions?.dailyPass?.enabled || event.passOptions?.seasonPass?.enabled) && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Pass Options</Text>
              {event.passOptions?.dailyPass?.enabled && (
                <View style={[styles.passRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={[styles.passName, { color: theme.text }]}>Daily Pass</Text>
                  <Text style={[styles.passPrice, { color: theme.primary }]}>₹{event.passOptions.dailyPass.price}</Text>
                </View>
              )}
              {event.passOptions?.seasonPass?.enabled && (
                <View style={[styles.passRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={[styles.passName, { color: theme.text }]}>Season Pass</Text>
                  <Text style={[styles.passPrice, { color: theme.primary }]}>₹{event.passOptions.seasonPass.price}</Text>
                </View>
              )}
            </View>
          )}

          <Button
            title={isSoldOut ? 'Sold Out' : 'Book Seats'}
            onPress={() => navigation.navigate('LockSeats', { event })}
            disabled={isSoldOut}
            style={styles.bookBtn}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { paddingBottom: spacing.xl },
  image: { width: '100%', height: 240 },
  imagePlaceholder: { width: '100%', height: 200, justifyContent: 'center', alignItems: 'center' },
  placeholderLetter: { fontSize: 72, fontWeight: '800' },
  body: { padding: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  name: { fontSize: font.xxl, fontWeight: '800' },
  typeBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1, marginTop: 4 },
  typeBadgeText: { fontSize: font.xs, fontWeight: '800' },
  date: { fontSize: font.md, fontWeight: '600', marginBottom: spacing.lg },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statBox: { flex: 1, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1 },
  statVal: { fontSize: font.xl, fontWeight: '800' },
  statLabel: { fontSize: font.xs, marginTop: 2 },
  infoCard: { borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, marginBottom: spacing.lg },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  infoIcon: { fontSize: 20 },
  infoLabel: { fontSize: font.xs, fontWeight: '600' },
  infoValue: { fontSize: font.md, fontWeight: '700' },
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: font.lg, fontWeight: '700', marginBottom: spacing.sm },
  desc: { fontSize: font.md, lineHeight: 24 },
  passRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.sm },
  passName: { fontSize: font.md, fontWeight: '600' },
  passPrice: { fontSize: font.lg, fontWeight: '800' },
  bookBtn: { marginTop: spacing.sm },
});
