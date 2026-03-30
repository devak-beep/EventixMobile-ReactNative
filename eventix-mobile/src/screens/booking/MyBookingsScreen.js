import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, Alert, ScrollView, Image, Modal, TextInput, Pressable
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, font, radius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/StatusBadge';
import ConfirmModal from '../../components/ConfirmModal';
import { BookingCardSkeleton } from '../../components/SkeletonLoader';
import {
  getAllBookings, cancelBooking, getMyEvents,
  deleteEvent, getMyEventRequests, getPendingRequests,
  approveRequest, rejectRequest, getExpiredEvents
} from '../../api';
import api from '../../api';
import RazorpayCheckout from 'react-native-razorpay';

function AnimatedCard({ children, style, theme }) {
  const [pressed, setPressed] = useState(false);
  const flatStyle = StyleSheet.flatten(style) || {};
  return (
    <Pressable onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}>
      <View style={[
        style,
        { borderColor: pressed ? theme?.primary : flatStyle.borderColor },
        pressed && { shadowColor: theme?.primary, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
      ]}>{children}</View>
    </Pressable>
  );
}

// ── Tab bar ──────────────────────────────────────────────────────────────────
function TabBar({ tabs, active, onPress, theme }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabBar, { backgroundColor: theme.bg, borderBottomColor: theme.border }]} contentContainerStyle={styles.tabBarContent}>
      {tabs.map(t => (
        <TouchableOpacity key={t.key} style={[styles.tab, active === t.key && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]} onPress={() => onPress(t.key)}>
          <Text style={[styles.tabText, { color: active === t.key ? theme.primary : theme.textMuted }]}>{t.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ── My Bookings tab ──────────────────────────────────────────────────────────
function BookingsTab({ userId, theme }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelId, setCancelId] = useState(null);

  const fetch = useCallback(async () => {
    try {
      const res = await getAllBookings();
      const all = Array.isArray(res) ? res : res.data || [];
      const mine = all.filter(b => (b.user?._id || b.user) === userId);
      setBookings(mine.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (_) {}
    setLoading(false); setRefreshing(false);
  }, [userId]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleCancel = async () => {
    try { await cancelBooking(cancelId); setCancelId(null); fetch(); }
    catch (err) { Alert.alert('Error', err.response?.data?.error || 'Failed'); setCancelId(null); }
  };

  if (loading) return <FlatList data={[1,2,3]} keyExtractor={i=>String(i)} contentContainerStyle={styles.list} renderItem={() => <BookingCardSkeleton />} />;

  return (
    <>
      <FlatList
        data={bookings}
        keyExtractor={i => i._id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor={theme.primary} />}
        ListEmptyComponent={<View style={styles.empty}><Text style={[styles.emptyText, { color: theme.textMuted }]}>No bookings yet</Text></View>}
        renderItem={({ item }) => {
          const event = item.event || {};
          const canCancel = item.status === 'CONFIRMED';
          const isPending = item.status === 'PAYMENT_PENDING';
          const isExpired = item.paymentExpiresAt && new Date(item.paymentExpiresAt) < new Date();
          return (
            <AnimatedCard theme={theme} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.card }]}>
              {event.image ? <Image source={{ uri: event.image }} style={styles.eventImg} /> : null}
              <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>{event.name || 'Event'}</Text>
                  <StatusBadge status={item.status} />
                </View>
                <Text style={[styles.cardMeta, { color: theme.primary }]}>
                  {event.eventDate ? new Date(event.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </Text>
                <Text style={[styles.cardMeta, { color: theme.textMuted }]}>Transaction: <Text style={{ color: theme.text }}># {item._id?.slice(-6)}</Text></Text>
                <Text style={[styles.cardMeta, { color: theme.textMuted }]}>Booking ID: <Text style={{ color: theme.text, fontSize: font.xs }}>{item._id}</Text></Text>
                <Text style={[styles.cardMeta, { color: theme.textMuted }]}>User: <Text style={{ color: theme.text }}>{item.user?.name || '—'}</Text></Text>
                <Text style={[styles.cardMeta, { color: theme.textMuted }]}>Seats: <Text style={{ color: theme.text }}>{item.seats?.length || 0}</Text>
                  {item.passType && item.passType !== 'regular' ? <Text style={{ color: theme.primary }}>  ·  {item.passType === 'season' ? '🌟 Season Pass' : `🎟️ Day Pass${item.selectedDate ? ' — ' + new Date(item.selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}`}</Text> : null}
                </Text>
                {item.amount != null && <Text style={[styles.cardMeta, { color: theme.textMuted }]}>Amount Paid: <Text style={{ color: theme.primary, fontWeight: '700' }}>₹{item.amount}</Text></Text>}
                <Text style={[styles.cardMeta, { color: theme.textMuted }]}>Booked: <Text style={{ color: theme.text }}>{new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text></Text>
                {item.paymentExpiresAt && !isPending && (
                  <Text style={[styles.cardMeta, { color: theme.textMuted }]}>Payment Expires: <Text style={{ color: theme.text }}>{new Date(item.paymentExpiresAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text></Text>
                )}
                {isPending && item.paymentExpiresAt && (
                  <View style={[styles.expiryBox, { backgroundColor: (isExpired ? theme.danger : theme.warning) + '18', borderColor: isExpired ? theme.danger : theme.warning }]}>
                    <Text style={{ color: isExpired ? theme.danger : theme.warning, fontSize: font.sm, fontWeight: '600' }}>
                      {isExpired ? '⚠️ Payment window expired! Seats will be released.' : `⏰ Pay before: ${new Date(item.paymentExpiresAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                    </Text>
                  </View>
                )}
                {canCancel && (
                  <TouchableOpacity style={[styles.cancelBtn, { borderColor: theme.danger }]} onPress={() => setCancelId(item._id)}>
                    <Text style={[styles.cancelBtnText, { color: theme.danger }]}>Cancel Booking (50% refund)</Text>
                  </TouchableOpacity>
                )}
              </View>
            </AnimatedCard>
          );
        }}
      />
      <ConfirmModal visible={!!cancelId} title="Cancel Booking" message="Are you sure you want to cancel this booking?" onConfirm={handleCancel} onCancel={() => setCancelId(null)} confirmText="Yes, Cancel" type="danger" />
    </>
  );
}

// ── My Events tab (admin/superAdmin) ─────────────────────────────────────────
function MyEventsTab({ userId, userRole, theme, navigation }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [expandedDesc, setExpandedDesc] = useState({});
  const [expandedBookings, setExpandedBookings] = useState({});
  const [bookingsData, setBookingsData] = useState({});
  const [editEvent, setEditEvent] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const res = await getMyEvents(userId);
      setEvents(res.data || []);
    } catch (_) {}
    setLoading(false); setRefreshing(false);
  }, [userId]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleDelete = async () => {
    try { await deleteEvent(deleteId, { userId, userRole }); setDeleteId(null); fetch(); }
    catch (err) { Alert.alert('Error', err.response?.data?.error || 'Failed'); setDeleteId(null); }
  };

  const toggleBookings = async (eventId) => {
    if (expandedBookings[eventId]) {
      setExpandedBookings(p => ({ ...p, [eventId]: false }));
      return;
    }
    try {
      const res = await api.get(`/bookings?eventId=${eventId}`);
      const confirmed = (res.data?.data || []).filter(b => b.status === 'CONFIRMED');
      setBookingsData(p => ({ ...p, [eventId]: confirmed }));
      setExpandedBookings(p => ({ ...p, [eventId]: true }));
    } catch (_) {}
  };

  const handleSaveEdit = async () => {
    if (!editEvent) return;
    setSaving(true);
    try {
      await api.patch(`/events/${editEvent._id}/details`, { userId, userRole, name: editName, description: editDesc });
      setEditEvent(null);
      fetch();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update');
    } finally { setSaving(false); }
  };

  const handleImagePick = async (eventId) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access to change image.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7, allowsEditing: true, aspect: [16, 9] });
    if (result.canceled) return;
    const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
    try {
      await api.patch(`/events/${eventId}/image`, { userId, userRole, image: base64 });
      fetch();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update image');
    }
  };

  if (loading) return <FlatList data={[1,2,3]} keyExtractor={i=>String(i)} contentContainerStyle={styles.list} renderItem={() => <BookingCardSkeleton />} />;

  return (
    <>
      <FlatList
        data={events}
        keyExtractor={i => i._id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor={theme.primary} />}
        ListEmptyComponent={<View style={styles.empty}><Text style={[styles.emptyText, { color: theme.textMuted }]}>No events created yet</Text></View>}
        renderItem={({ item }) => {
          const booked = item.totalSeats - item.availableSeats;
          const isDescExpanded = expandedDesc[item._id];
          const isBookingsExpanded = expandedBookings[item._id];
          const bookings = bookingsData[item._id] || [];
          return (
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {/* Image with Change Image button */}
              <View>
                {item.image
                  ? <Image source={{ uri: item.image }} style={styles.eventImg} />
                  : <View style={[styles.imgPlaceholder, { backgroundColor: theme.bgSecondary }]}><Text style={{ color: theme.textMuted }}>No Image</Text></View>
                }
                <TouchableOpacity
                  style={[styles.changeImgBtn, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
                  onPress={() => handleImagePick(item._id)}
                >
                  <Text style={{ color: '#fff', fontSize: font.xs, fontWeight: '700' }}>📷 {item.image ? 'Change Image' : 'Add Image'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.cardBody}>
                {/* Header with Edit button */}
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: theme.text, flex: 1 }]} numberOfLines={1}>{item.name}</Text>
                  <TouchableOpacity
                    style={[styles.editBtn, { backgroundColor: theme.primary + '22', borderColor: theme.primary }]}
                    onPress={() => { setEditEvent(item); setEditName(item.name); setEditDesc(item.description || ''); }}
                  >
                    <Text style={{ color: theme.primary, fontSize: font.xs, fontWeight: '700' }}>✏️ Edit</Text>
                  </TouchableOpacity>
                  <View style={[styles.typeBadge, { backgroundColor: item.type === 'private' ? theme.warning + '22' : theme.success + '22', borderColor: item.type === 'private' ? theme.warning : theme.success }]}>
                    <Text style={[styles.typeBadgeText, { color: item.type === 'private' ? theme.warning : theme.success }]}>{item.type === 'private' ? '🔒 Private' : '🌍 Public'}</Text>
                  </View>
                </View>

                {/* Description with expand */}
                {item.description ? (
                  <>
                    <Text style={[styles.cardMeta, { color: theme.textMuted }]} numberOfLines={isDescExpanded ? undefined : 2}>{item.description}</Text>
                    <TouchableOpacity onPress={() => setExpandedDesc(p => ({ ...p, [item._id]: !isDescExpanded }))}>
                      <Text style={{ color: theme.primary, fontSize: font.xs, marginBottom: spacing.xs }}>{isDescExpanded ? 'Show less' : 'Read more'}</Text>
                    </TouchableOpacity>
                  </>
                ) : null}

                {/* Details rows */}
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Event Date</Text><Text style={[styles.detailValue, { color: theme.primary }]}>{new Date(item.eventDate).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text></View>
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Event ID</Text><Text style={[styles.detailValue, { color: theme.text, fontSize: font.xs }]}>{item._id}</Text></View>
                {(userRole === 'admin' || userRole === 'superAdmin') && item.createdBy && (
                  <View style={styles.detailRow}><Text style={styles.detailLabel}>Created By</Text><Text style={[styles.detailValue, { color: theme.text }]}>{item.createdBy?.name || item.createdBy}</Text></View>
                )}
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Created</Text><Text style={[styles.detailValue, { color: theme.text }]}>{new Date(item.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text></View>
                {item.category && <View style={styles.detailRow}><Text style={styles.detailLabel}>Category</Text><Text style={[styles.detailValue, { color: theme.text }]}>{Array.isArray(item.category) ? item.category.join(', ') : item.category}</Text></View>}
                {item.creationCharge > 0 && <View style={styles.detailRow}><Text style={styles.detailLabel}>Platform Fee</Text><Text style={[styles.detailValue, { color: theme.text }]}>₹{item.creationCharge}</Text></View>}
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Total Seats</Text><Text style={[styles.detailValue, { color: theme.text }]}>{item.totalSeats}</Text></View>
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Available Seats</Text><Text style={[styles.detailValue, { color: theme.text }]}>{item.availableSeats}</Text></View>
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Booked Seats</Text><Text style={[styles.detailValue, { color: theme.text }]}>{booked}</Text></View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Ticket Price</Text>
                  <Text style={[styles.detailValue, { color: theme.primary, fontWeight: '700' }]}>
                    {item.eventType === 'multi-day'
                      ? `🎟️ ₹${item.passOptions?.dailyPass?.price || 0}  ·  🌟 ₹${item.passOptions?.seasonPass?.price || 0}`
                      : (item.amount || 0) > 0 ? `₹${item.amount}` : 'Free'}
                  </Text>
                </View>
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Total Collection</Text><Text style={[styles.detailValue, { color: theme.primary, fontWeight: '700' }]}>₹{booked * (item.amount || 0)}</Text></View>

                {/* View Bookings */}
                <TouchableOpacity style={[styles.viewBookingsBtn, { backgroundColor: isBookingsExpanded ? theme.primary + 'dd' : theme.primary }]} onPress={() => toggleBookings(item._id)}>
                  <Text style={styles.viewBookingsBtnText}>{isBookingsExpanded ? 'Hide Bookings' : `View Bookings (${booked})`}</Text>
                </TouchableOpacity>

                {isBookingsExpanded && (
                  <View style={[styles.bookingsTable, { borderColor: theme.border, backgroundColor: theme.bgSecondary }]}>
                    <Text style={[styles.bookingsTableTitle, { color: theme.text }]}>📋 Confirmed Bookings ({bookings.length})</Text>
                    {bookings.length === 0
                      ? <Text style={{ color: theme.textMuted, fontSize: font.sm }}>No confirmed bookings yet.</Text>
                      : bookings.map(b => (
                        <View key={b._id} style={[styles.bookingRow, { borderBottomColor: theme.border }]}>
                          <Text style={[styles.bookingRowText, { color: theme.text, flex: 2 }]}>{b.user?.name || 'Unknown'}</Text>
                          <Text style={[styles.bookingRowText, { color: theme.textMuted, flex: 2 }]} numberOfLines={1}>{b.user?.email || 'N/A'}</Text>
                          <Text style={[styles.bookingRowText, { color: theme.text, flex: 1, textAlign: 'center' }]}>{Array.isArray(b.seats) ? b.seats.length : b.seats}</Text>
                          <Text style={[styles.bookingRowText, { color: theme.success, flex: 1, textAlign: 'right' }]}>₹{b.amount || 0}</Text>
                        </View>
                      ))
                    }
                  </View>
                )}

                {/* Delete */}
                <TouchableOpacity style={[styles.cancelBtn, { borderColor: theme.danger }]} onPress={() => setDeleteId(item._id)}>
                  <Text style={[styles.cancelBtnText, { color: theme.danger }]}>Delete Event</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
      <ConfirmModal visible={!!deleteId} title="Delete Event" message="This will permanently delete the event." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} confirmText="Delete" type="danger" />

      {/* Edit Modal */}
      <Modal visible={!!editEvent} transparent animationType="slide" onRequestClose={() => setEditEvent(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Event</Text>
            <Text style={[styles.modalLabel, { color: theme.textMuted }]}>Name</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBg }]}
              value={editName}
              onChangeText={setEditName}
              maxLength={100}
            />
            <Text style={[styles.modalLabel, { color: theme.textMuted }]}>Description</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBg, height: 100, textAlignVertical: 'top' }]}
              value={editDesc}
              onChangeText={setEditDesc}
              multiline
              maxLength={1500}
            />
            <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
              <TouchableOpacity style={[styles.actionBtn, { borderColor: theme.border, marginRight: spacing.sm }]} onPress={() => setEditEvent(null)}>
                <Text style={{ color: theme.textMuted, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.primary, borderColor: theme.primary }]} onPress={handleSaveEdit} disabled={saving}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ── Event Requests tab ───────────────────────────────────────────────────────
function RequestsTab({ userId, userRole, theme, navigation }) {
  const isAdmin = userRole === 'admin' || userRole === 'superAdmin';
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTargetId, setRejectTargetId] = useState(null);

  const loadRequests = useCallback(async () => {
    try {
      const res = isAdmin ? await getPendingRequests(userId, userRole) : await getMyEventRequests(userId);
      setRequests(res.requests || []);
    } catch (_) {}
    setLoading(false); setRefreshing(false);
  }, [userId, userRole, isAdmin]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const handleApprove = async (id) => {
    try { await approveRequest(id, userId, userRole); loadRequests(); }
    catch (err) { Alert.alert('Error', err.response?.data?.error || 'Failed'); }
  };

  const openRejectModal = (id) => { setRejectTargetId(id); setRejectReason(''); setRejectModalVisible(true); };

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) return Alert.alert('Required', 'Please enter a rejection reason.');
    setRejectModalVisible(false);
    try { await rejectRequest(rejectTargetId, userId, userRole, rejectReason); loadRequests(); }
    catch (err) { Alert.alert('Error', err.response?.data?.error || 'Failed'); }
  };

  const handlePayPlatformFee = async (item) => {
    setPayingId(item._id);
    try {
      const orderRes = await api.post(
        `/event-requests/${item._id}/create-order`, {},
        { headers: { 'x-user-id': userId, 'x-user-role': userRole } }
      );
      if (!orderRes.data.success) throw new Error(orderRes.data.message);
      const { order } = orderRes.data;
      const paymentData = await RazorpayCheckout.open({
        key: 'rzp_test_SHAhOPLrcvfFUi',
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: 'Eventix',
        description: `Platform Fee - ${item.name}`,
        theme: { color: '#0ea5e9' },
      });
      const verifyRes = await api.post(
        `/event-requests/${item._id}/verify-payment`,
        { razorpay_order_id: paymentData.razorpay_order_id, razorpay_payment_id: paymentData.razorpay_payment_id, razorpay_signature: paymentData.razorpay_signature },
        { headers: { 'x-user-id': userId, 'x-user-role': userRole } }
      );
      if (verifyRes.data.success) { Alert.alert('🎉 Success', `Event "${item.name}" created successfully!`); loadRequests(); }
      else Alert.alert('Error', 'Payment verification failed');
    } catch (err) {
      if (err.code !== 2) Alert.alert('Payment Failed', err.description || err.response?.data?.message || err.response?.data?.error || err.message || 'Payment could not be processed');
    } finally { setPayingId(null); }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  if (loading) return <FlatList data={[1,2,3]} keyExtractor={i=>String(i)} contentContainerStyle={styles.list} renderItem={() => <BookingCardSkeleton />} />;

  return (
    <>
      <FlatList
        data={requests}
        keyExtractor={i => i._id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRequests(); }} tintColor={theme.primary} />}
        ListEmptyComponent={<View style={styles.empty}><Text style={[styles.emptyText, { color: theme.textMuted }]}>No requests found</Text></View>}
        renderItem={({ item }) => {
          const isCompleted = item.status === 'COMPLETED';
          const isRejected = item.status === 'REJECTED';
          const canPay = item.status === 'APPROVED' || item.status === 'PAYMENT_PENDING';
          const isMultiDay = item.eventType === 'multi-day';
          let borderColor = theme.border;
          if (isRejected) borderColor = theme.danger;
          else if (isCompleted) borderColor = theme.success;
          else if (canPay) borderColor = theme.primary;

          let timeRemaining = null;
          if (canPay && item.paymentExpiresAt) {
            const diff = new Date(item.paymentExpiresAt) - new Date();
            if (diff > 0) {
              const h = Math.floor(diff / 3600000);
              const m = Math.floor((diff % 3600000) / 60000);
              timeRemaining = `${h}h ${m}m`;
            }
          }

          return (
            <View style={[styles.card, { backgroundColor: theme.card, borderColor }]}>
              {item.image ? <Image source={{ uri: item.image }} style={styles.eventImg} /> : null}
              <View style={styles.cardBody}>
                {/* Title + Status */}
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>{item.name}</Text>
                  <StatusBadge status={item.status} />
                </View>

                {/* Description */}
                {item.description ? (
                  <Text style={[styles.cardMeta, { color: theme.textMuted }]} numberOfLines={2}>{item.description}</Text>
                ) : null}

                {/* Date(s) */}
                <Text style={[styles.cardMeta, { color: theme.primary }]}>
                  📅 {fmtDate(item.eventDate)}{isMultiDay && item.endDate ? ` → ${fmtDate(item.endDate)}` : ''}
                  {isMultiDay ? '  ·  Multi-day' : '  ·  Single-day'}
                </Text>

                {/* Category */}
                {item.category?.length > 0 && (
                  <Text style={[styles.cardMeta, { color: theme.textMuted }]}>
                    🏷 <Text style={{ color: theme.text }}>{item.category.map(c => c.replace(/-/g, ' ')).join(', ')}</Text>
                  </Text>
                )}

                {/* Seats · Visibility · Ticket price */}
                <Text style={[styles.cardMeta, { color: theme.textMuted }]}>
                  Seats: <Text style={{ color: theme.text }}>{item.totalSeats}</Text>
                  {'  ·  '}Visibility: <Text style={{ color: theme.text }}>{item.type}</Text>
                  {!isMultiDay ? <>{'  ·  '}Ticket: <Text style={{ color: theme.primary }}>₹{item.amount || 0}</Text></> : null}
                </Text>

                {/* Pass options for multi-day */}
                {isMultiDay && (item.passOptions?.dailyPass?.enabled || item.passOptions?.seasonPass?.enabled) && (
                  <Text style={[styles.cardMeta, { color: theme.textMuted }]}>
                    {item.passOptions.dailyPass?.enabled ? `Daily Pass: ₹${item.passOptions.dailyPass.price}` : ''}
                    {item.passOptions.dailyPass?.enabled && item.passOptions.seasonPass?.enabled ? '  ·  ' : ''}
                    {item.passOptions.seasonPass?.enabled ? `Season Pass: ₹${item.passOptions.seasonPass.price}` : ''}
                  </Text>
                )}

                {/* Submitted date */}
                <Text style={[styles.cardMeta, { color: theme.textMuted }]}>
                  Submitted: <Text style={{ color: theme.text }}>{fmtDate(item.createdAt)}</Text>
                </Text>

                {/* Platform fee */}
                {item.platformFee ? (
                  <Text style={[styles.cardMeta, { color: theme.textMuted }]}>
                    Platform Fee: <Text style={{ color: theme.text }}>₹{item.platformFee}</Text>
                  </Text>
                ) : null}

                {/* Payment countdown */}
                {canPay && timeRemaining && (
                  <Text style={[styles.cardMeta, { color: theme.warning, fontWeight: '600' }]}>⏰ Pay within: {timeRemaining}</Text>
                )}

                {/* Admin note */}
                {item.adminNote ? (
                  <View style={[styles.expiryBox, { backgroundColor: (isRejected ? theme.danger : theme.primary) + '12', borderColor: isRejected ? theme.danger : theme.primary }]}>
                    <Text style={{ color: isRejected ? theme.danger : theme.primary, fontSize: font.sm }}>
                      <Text style={{ fontWeight: '700' }}>{isRejected ? 'Rejection Reason: ' : 'Admin Note: '}</Text>
                      {item.adminNote}
                      {item.reviewedBy?.name ? <Text style={{ fontWeight: '400' }}> — by {item.reviewedBy.name}</Text> : null}
                    </Text>
                  </View>
                ) : null}

                {/* Pay platform fee button (user) */}
                {!isAdmin && canPay && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.primary, borderColor: theme.primary, marginTop: spacing.sm }]}
                    onPress={() => handlePayPlatformFee(item)}
                    disabled={payingId === item._id}
                  >
                    <Text style={[styles.actionBtnText, { color: '#fff' }]}>
                      {payingId === item._id ? 'Processing...' : `💳 Pay ₹${item.platformFee} to Create Event`}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* View created event button */}
                {isCompleted && item.createdEventId && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.success + '22', borderColor: theme.success, marginTop: spacing.sm }]}
                    onPress={() => navigation.navigate('EventDetail', { eventId: item.createdEventId._id || item.createdEventId })}
                  >
                    <Text style={[styles.actionBtnText, { color: theme.success }]}>View Event →</Text>
                  </TouchableOpacity>
                )}

                {/* Admin approve/reject */}
                {isAdmin && item.status === 'PENDING' && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.success + '22', borderColor: theme.success }]} onPress={() => handleApprove(item._id)}>
                      <Text style={[styles.actionBtnText, { color: theme.success }]}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.danger + '22', borderColor: theme.danger }]} onPress={() => openRejectModal(item._id)}>
                      <Text style={[styles.actionBtnText, { color: theme.danger }]}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* Reject reason modal */}
      <Modal visible={rejectModalVisible} transparent animationType="fade" onRequestClose={() => setRejectModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Reject Request</Text>
            <Text style={[styles.cardMeta, { color: theme.textMuted, marginBottom: spacing.sm }]}>Enter rejection reason:</Text>
            <TextInput
              style={[styles.rejectInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Reason..."
              placeholderTextColor={theme.textMuted}
              multiline
            />
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.border, borderColor: theme.border }]} onPress={() => setRejectModalVisible(false)}>
                <Text style={[styles.actionBtnText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.danger + '22', borderColor: theme.danger }]} onPress={handleRejectConfirm}>
                <Text style={[styles.actionBtnText, { color: theme.danger }]}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ── Admin Requests tab (superAdmin only) ─────────────────────────────────────
function AdminRequestsTab({ theme }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const res = await api.get('/users/admin-requests/pending');
      setRequests(res.data?.data || []);
    } catch (_) {}
    setLoading(false); setRefreshing(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handle = async (id, action) => {
    try {
      await api.post(`/users/admin-requests/${id}/${action}`);
      fetch();
    } catch (err) { Alert.alert('Error', err.response?.data?.error || 'Failed'); }
  };

  if (loading) return <FlatList data={[1,2]} keyExtractor={i=>String(i)} contentContainerStyle={styles.list} renderItem={() => <BookingCardSkeleton />} />;

  return (
    <FlatList
      data={requests}
      keyExtractor={i => i._id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor={theme.primary} />}
      ListEmptyComponent={<View style={styles.empty}><Text style={[styles.emptyText, { color: theme.textMuted }]}>No pending admin requests</Text></View>}
      renderItem={({ item }) => (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{item.user?.name || 'User'}</Text>
          <Text style={[styles.cardMeta, { color: theme.textMuted }]}>{item.user?.email}</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.success + '22', borderColor: theme.success }]} onPress={() => handle(item._id, 'approve')}>
              <Text style={[styles.actionBtnText, { color: theme.success }]}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.danger + '22', borderColor: theme.danger }]} onPress={() => handle(item._id, 'reject')}>
              <Text style={[styles.actionBtnText, { color: theme.danger }]}>Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    />
  );
}

// ── Expired Events tab (admin/superAdmin only) ───────────────────────────────
function ExpiredEventsTab({ userRole, theme }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const res = await getExpiredEvents(userRole);
      setEvents(res.data || []);
    } catch (_) {}
    setLoading(false); setRefreshing(false);
  }, [userRole]);

  useEffect(() => { fetch(); }, [fetch]);

  if (loading) return <FlatList data={[1,2,3]} keyExtractor={i=>String(i)} contentContainerStyle={styles.list} renderItem={() => <BookingCardSkeleton />} />;

  return (
    <FlatList
      data={events}
      keyExtractor={i => i._id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor={theme.primary} />}
      ListEmptyComponent={<View style={styles.empty}><Text style={[styles.emptyText, { color: theme.textMuted }]}>No expired events</Text></View>}
      renderItem={({ item }) => {
        const isMultiDay = item.eventType === 'multi-day';
        const booked = item.totalSeats - item.availableSeats;
        const revenue = isMultiDay ? null : booked * (item.amount || 0);
        return (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {item.image
              ? <Image source={{ uri: item.image }} style={styles.eventImg} />
              : null}
            <View style={[styles.expiredBadgeRow]}>
              <View style={[styles.typeBadge, { backgroundColor: '#6b728022', borderColor: '#6b7280' }]}>
                <Text style={[styles.typeBadgeText, { color: '#6b7280' }]}>Expired</Text>
              </View>
              <View style={[styles.typeBadge, { backgroundColor: item.type === 'private' ? theme.warning + '22' : theme.success + '22', borderColor: item.type === 'private' ? theme.warning : theme.success, marginLeft: 6 }]}>
                <Text style={[styles.typeBadgeText, { color: item.type === 'private' ? theme.warning : theme.success }]}>{item.type === 'private' ? '🔒 Private' : '🌍 Public'}</Text>
              </View>
            </View>
            <View style={styles.cardBody}>
              <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Date</Text><Text style={[styles.detailValue, { color: theme.text }]}>
                {isMultiDay && item.endDate
                  ? `${new Date(item.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} → ${new Date(item.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : new Date(item.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text></View>
              {item.createdBy && <View style={styles.detailRow}><Text style={styles.detailLabel}>Organizer</Text><Text style={[styles.detailValue, { color: theme.text }]}>{item.createdBy.name}</Text></View>}
              {item.approvedBy && <View style={styles.detailRow}><Text style={styles.detailLabel}>Approved By</Text><Text style={[styles.detailValue, { color: theme.text }]}>{item.approvedBy.name}</Text></View>}
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Total Seats</Text><Text style={[styles.detailValue, { color: theme.text }]}>{item.totalSeats}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Seats Sold</Text><Text style={[styles.detailValue, { color: theme.text }]}>{booked} / {item.totalSeats}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Ticket Price</Text><Text style={[styles.detailValue, { color: theme.primary, fontWeight: '700' }]}>
                {isMultiDay
                  ? `🎟️ ₹${item.passOptions?.dailyPass?.price || 0}  ·  🌟 ₹${item.passOptions?.seasonPass?.price || 0}`
                  : (item.amount || 0) > 0 ? `₹${item.amount}` : 'Free'}
              </Text></View>
              {revenue !== null && <View style={styles.detailRow}><Text style={styles.detailLabel}>Total Revenue</Text><Text style={[styles.detailValue, { color: theme.success, fontWeight: '700' }]}>₹{revenue}</Text></View>}
              {item.creationCharge > 0 && <View style={styles.detailRow}><Text style={styles.detailLabel}>Platform Fee</Text><Text style={[styles.detailValue, { color: theme.text }]}>₹{item.creationCharge}</Text></View>}
            </View>
          </View>
        );
      }}
    />
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function MyBookingsScreen({ navigation }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const role = user?.role;
  const userId = user?._id;

  const tabs = [
    { key: 'bookings', label: 'My Bookings' },
    ...(role === 'admin' || role === 'superAdmin' ? [{ key: 'events', label: 'My Events' }] : []),
    ...(role === 'admin' || role === 'superAdmin' ? [{ key: 'expired', label: 'Expired Events' }] : []),
    { key: 'requests', label: role === 'user' ? 'My Requests' : 'Event Requests' },
    ...(role === 'superAdmin' ? [{ key: 'adminRequests', label: 'Admin Requests' }] : []),
  ];

  const [activeTab, setActiveTab] = useState('bookings');

  if (!userId) return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
      <View style={styles.empty}><Text style={[styles.emptyText, { color: theme.textMuted }]}>Please log in to view bookings</Text></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={['bottom']}>
      <TabBar tabs={tabs} active={activeTab} onPress={setActiveTab} theme={theme} />
      {activeTab === 'bookings' && <BookingsTab userId={userId} theme={theme} />}
      {activeTab === 'events' && <MyEventsTab userId={userId} userRole={role} theme={theme} navigation={navigation} />}
      {activeTab === 'expired' && <ExpiredEventsTab userRole={role} theme={theme} />}
      {activeTab === 'requests' && <RequestsTab userId={userId} userRole={role} theme={theme} navigation={navigation} />}
      {activeTab === 'adminRequests' && <AdminRequestsTab theme={theme} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  tabBar: { flexGrow: 0, borderBottomWidth: 1 },
  tabBarContent: { paddingHorizontal: spacing.md },
  tab: { paddingVertical: spacing.md, paddingHorizontal: spacing.md, marginRight: spacing.xs },
  tabText: { fontSize: font.sm, fontWeight: '700' },
  list: { padding: spacing.md, paddingBottom: spacing.xl },
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden', marginBottom: spacing.md },
  cardBody: { padding: spacing.md },
  eventImg: { width: '100%', height: 120 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xs },
  cardTitle: { fontSize: font.lg, fontWeight: '700', flex: 1 },
  cardMeta: { fontSize: font.sm, marginBottom: 2 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  cardAmount: { fontSize: font.md, fontWeight: '700' },
  cancelBtn: { borderWidth: 1, borderRadius: radius.sm, paddingVertical: 8, alignItems: 'center', marginTop: spacing.sm },
  cancelBtnText: { fontWeight: '700', fontSize: font.sm },
  expiryBox: { borderWidth: 1, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.sm },
  typeBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm, borderWidth: 1 },
  typeBadgeText: { fontSize: font.xs, fontWeight: '800' },
  actionRow: { flexDirection: 'row', marginTop: spacing.sm },
  actionBtn: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', marginHorizontal: spacing.xs / 2 },
  actionBtnText: { fontWeight: '700', fontSize: font.sm },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: font.lg },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xl },
  modalTitle: { fontSize: font.lg, fontWeight: '800', marginBottom: spacing.md },
  rejectInput: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: font.md, minHeight: 80, textAlignVertical: 'top', marginBottom: spacing.md },
  modalLabel: { fontSize: font.sm, marginBottom: 4, marginTop: spacing.sm },
  modalInput: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: font.md },
  imgPlaceholder: { height: 80, justifyContent: 'center', alignItems: 'center' },
  changeImgBtn: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm },
  editBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1, marginRight: spacing.xs },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(148,163,184,0.15)' },
  detailLabel: { fontSize: font.sm, color: '#94a3b8', flex: 1 },
  detailValue: { fontSize: font.sm, flex: 2, textAlign: 'right' },
  viewBookingsBtn: { borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center', marginTop: spacing.md },
  viewBookingsBtnText: { color: '#fff', fontWeight: '700', fontSize: font.sm },
  bookingsTable: { marginTop: spacing.sm, borderRadius: radius.sm, borderWidth: 1, padding: spacing.sm },
  bookingsTableTitle: { fontWeight: '700', fontSize: font.sm, marginBottom: spacing.sm },
  expiredBadgeRow: { flexDirection: 'row', padding: spacing.sm, paddingBottom: 0 },
  bookingRowText: { fontSize: font.xs },
});
