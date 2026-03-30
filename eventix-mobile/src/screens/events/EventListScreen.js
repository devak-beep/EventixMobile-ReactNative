import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, TextInput, Image, ScrollView, Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, font, radius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { EventCardSkeleton } from '../../components/SkeletonLoader';
import { getAllPublicEvents, getEventById } from '../../api';
import { useAuth } from '../../context/AuthContext';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'concerts-music', label: 'Concerts' },
  { key: 'food-drink', label: 'Food & Drink' },
  { key: 'sports-live', label: 'Sports' },
  { key: 'dance-party', label: 'Dance' },
  { key: 'arts-theater', label: 'Arts' },
  { key: 'comedy-standup', label: 'Comedy' },
  { key: 'festivals-cultural', label: 'Festivals' },
  { key: 'movies-premieres', label: 'Movies' },
];

function EventCard({ event, onPress, theme }) {
  const date = new Date(event.eventDate);
  const isMultiDay = event.eventType === 'multi-day';
  const isSoldOut = event.availableSeats === 0;
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      <View style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: pressed ? theme.primary : theme.border },
        pressed && { shadowColor: theme.primary, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
      ]}>
        {event.image ? (
          <Image source={{ uri: event.image }} style={styles.cardImg} />
        ) : (
          <View style={[styles.cardImgPlaceholder, { backgroundColor: theme.bgSecondary }]}>
            <Text style={[styles.placeholderLetter, { color: theme.primary }]}>{event.name?.[0]?.toUpperCase()}</Text>
          </View>
        )}
        {isSoldOut && (
          <View style={styles.soldOutBadge}>
            <Text style={styles.soldOutText}>SOLD OUT</Text>
          </View>
        )}
        {event.type === 'private' && (
          <View style={[styles.privateBadge, { backgroundColor: theme.warning }]}>
            <Text style={styles.privateBadgeText}>PRIVATE</Text>
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>{event.name}</Text>
          <Text style={[styles.cardDate, { color: theme.primary }]}>
            {date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            {isMultiDay && event.endDate ? ` – ${new Date(event.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
          </Text>
          {event.description ? <Text style={[styles.cardDesc, { color: theme.textMuted }]} numberOfLines={2}>{event.description}</Text> : null}
          <View style={styles.cardFooter}>
            <Text style={[styles.cardPrice, { color: theme.primary }]}>
              {isMultiDay
                ? event.passOptions?.dailyPass?.enabled
                  ? `₹${event.passOptions.dailyPass.price}/day`
                  : event.passOptions?.seasonPass?.enabled
                    ? `₹${event.passOptions.seasonPass.price} season`
                    : '₹0'
                : `₹${event.amount}`}
            </Text>
            <Text style={[styles.cardSeats, { color: isSoldOut ? theme.danger : theme.textMuted }]}>
              {isSoldOut ? 'Sold Out' : `${event.availableSeats} left`}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function EventListScreen({ navigation }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [events, setEvents] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchMode, setSearchMode] = useState('public');
  const [publicSearch, setPublicSearch] = useState('');
  const [privateId, setPrivateId] = useState('');
  const [privateLoading, setPrivateLoading] = useState(false);
  const [category, setCategory] = useState('all');

  const fetchEvents = useCallback(async () => {
    try {
      const res = await getAllPublicEvents(user?.role || 'user');
      const list = res.data || [];
      setEvents(list);
      setFiltered(list);
    } catch (_) {}
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    if (searchMode !== 'public') return;
    const now = new Date();
    let list = events.filter(e => {
      const isMultiDay = e.eventType === 'multi-day';
      const expiry = isMultiDay && e.endDate
        ? new Date(new Date(e.endDate).setHours(23, 59, 59, 999))
        : new Date(e.eventDate);
      return expiry > now;
    });
    if (category !== 'all') list = list.filter(e => e.category?.includes(category));
    if (publicSearch.trim()) {
      const q = publicSearch.toLowerCase();
      list = list.filter(e =>
        e.name?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [publicSearch, category, events, searchMode]);

  const handlePrivateSearch = async () => {
    if (!privateId.trim()) return;
    setPrivateLoading(true);
    try {
      const res = await getEventById(privateId.trim());
      if (res.data) navigation.navigate('EventDetail', { eventId: res.data._id });
    } catch {
      alert('Event not found. Check the ID and try again.');
    } finally { setPrivateLoading(false); }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={['bottom']}>
      <View style={[styles.modeRow, { backgroundColor: theme.bg }]}>
        {['public', 'private'].map(m => (
          <TouchableOpacity
            key={m}
            style={[styles.modeBtn, { borderColor: searchMode === m ? theme.primary : theme.border, backgroundColor: searchMode === m ? theme.primary + '18' : 'transparent' }]}
            onPress={() => setSearchMode(m)}
          >
            <Text style={[styles.modeBtnText, { color: searchMode === m ? theme.primary : theme.textMuted }]}>
              {m === 'public' ? 'Public Events' : 'Private Event'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {searchMode === 'private' ? (
        <View style={styles.privateContainer}>
          <Text style={[styles.privateTitle, { color: theme.text }]}>Find Private Event</Text>
          <Text style={[styles.privateSubtitle, { color: theme.textMuted }]}>Enter the event ID shared with you</Text>
          <View style={[styles.privateInputRow, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
            <TextInput
              style={[styles.privateInput, { color: theme.text }]}
              placeholder="Paste event ID here..."
              placeholderTextColor={theme.textMuted}
              value={privateId}
              onChangeText={setPrivateId}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.privateSearchBtn, { backgroundColor: theme.primary }]}
              onPress={handlePrivateSearch}
              disabled={privateLoading}
            >
              <Text style={styles.privateSearchBtnText}>{privateLoading ? '...' : 'Find'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <View style={[styles.searchRow, { backgroundColor: theme.bg }]}>
            <TextInput
              style={[styles.search, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
              placeholder="Search events by name..."
              placeholderTextColor={theme.textMuted}
              value={publicSearch}
              onChangeText={setPublicSearch}
            />
          </View>

          <View style={styles.catWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catContent}
            >
              {CATEGORIES.map(item => {
                const isActive = category === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    onPress={() => setCategory(item.key)}
                    style={[
                      styles.catChip,
                      {
                        backgroundColor: isActive ? theme.primary : theme.card,
                        borderColor: isActive ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <Text style={[styles.catText, { color: isActive ? '#fff' : theme.textMuted }]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {loading ? (
            <FlatList data={[1, 2, 3]} keyExtractor={i => String(i)} contentContainerStyle={styles.list} renderItem={() => <EventCardSkeleton />} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={i => i._id}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEvents(); }} tintColor={theme.primary} />}
              ListEmptyComponent={<View style={styles.empty}><Text style={[styles.emptyText, { color: theme.textMuted }]}>No events found</Text></View>}
              renderItem={({ item }) => (
                <EventCard event={item} theme={theme} onPress={() => navigation.navigate('EventDetail', { eventId: item._id })} />
              )}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  modeRow: { flexDirection: 'row', padding: spacing.md, gap: spacing.sm },
  modeBtn: { flex: 1, paddingVertical: 9, borderRadius: radius.full, borderWidth: 1.5, alignItems: 'center' },
  modeBtnText: { fontSize: font.sm, fontWeight: '700' },
  privateContainer: { padding: spacing.md, paddingTop: spacing.md },
  privateTitle: { fontSize: font.lg, fontWeight: '700', marginBottom: spacing.xs },
  privateSubtitle: { fontSize: font.sm, marginBottom: spacing.md },
  privateInputRow: { flexDirection: 'row', borderRadius: radius.md, borderWidth: 1, overflow: 'hidden', marginTop: spacing.xs },
  privateInput: { flex: 1, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: font.md },
  privateSearchBtn: { paddingHorizontal: spacing.lg, justifyContent: 'center' },
  privateSearchBtnText: { color: '#fff', fontWeight: '700', fontSize: font.md },
  searchRow: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  search: { borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: font.md, borderWidth: 1 },
  catWrapper: { height: 48 },
  catContent: { paddingHorizontal: spacing.md, gap: spacing.sm, alignItems: 'center' },
  catChip: { height: 36, paddingHorizontal: 16, borderRadius: radius.full, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  catText: { fontSize: font.sm, fontWeight: '600' },
  list: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  card: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1 },
  cardImg: { width: '100%', height: 170 },
  cardImgPlaceholder: { width: '100%', height: 130, justifyContent: 'center', alignItems: 'center' },
  placeholderLetter: { fontSize: 48, fontWeight: '800' },
  soldOutBadge: { position: 'absolute', top: spacing.sm, right: spacing.sm, backgroundColor: '#ef4444', paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  soldOutText: { color: '#fff', fontSize: font.xs, fontWeight: '800' },
  privateBadge: { position: 'absolute', top: spacing.sm, left: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  privateBadgeText: { color: '#fff', fontSize: font.xs, fontWeight: '800' },
  cardBody: { padding: spacing.md },
  cardTitle: { fontSize: font.lg, fontWeight: '700', marginBottom: spacing.xs },
  cardDate: { fontSize: font.sm, marginBottom: spacing.xs, fontWeight: '500' },
  cardDesc: { fontSize: font.sm, lineHeight: 20, marginBottom: spacing.sm },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardPrice: { fontSize: font.lg, fontWeight: '800' },
  cardSeats: { fontSize: font.sm },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: font.lg },
});
