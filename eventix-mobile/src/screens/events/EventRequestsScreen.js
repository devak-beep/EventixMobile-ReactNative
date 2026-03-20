import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, Alert, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, font, radius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import StatusBadge from '../../components/StatusBadge';
import Button from '../../components/Button';
import { getMyEventRequests, getPendingRequests, approveRequest, rejectRequest } from '../../api';
import { useAuth } from '../../context/AuthContext';

export default function EventRequestsScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isAdmin = user?.role === 'admin' || user?.role === 'superAdmin';
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchRequests = useCallback(async () => {
    try {
      const res = isAdmin ? await getPendingRequests(user._id, user.role) : await getMyEventRequests(user._id);
      setRequests(res.data || []);
    } catch (_) {}
    setLoading(false); setRefreshing(false);
  }, [isAdmin, user]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleApprove = async (id) => {
    try { await approveRequest(id, user._id, user.role); fetchRequests(); }
    catch (err) { Alert.alert('Error', err.response?.data?.error || 'Failed'); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return Alert.alert('Error', 'Provide a rejection reason');
    try { await rejectRequest(rejectModal, user._id, user.role, rejectReason); setRejectModal(null); setRejectReason(''); fetchRequests(); }
    catch (err) { Alert.alert('Error', err.response?.data?.error || 'Failed'); }
  };

  const renderItem = ({ item }) => (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
        <StatusBadge status={item.status} />
      </View>
      {item.description ? <Text style={[styles.desc, { color: theme.textMuted }]} numberOfLines={2}>{item.description}</Text> : null}
      <View style={styles.meta}>
        <Text style={[styles.metaText, { color: theme.textMuted }]}>{item.eventDate ? new Date(item.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</Text>
        <Text style={[styles.metaText, { color: theme.textMuted }]}>{item.totalSeats} seats</Text>
        <Text style={[styles.metaText, { color: theme.primary }]}>₹{item.amount}</Text>
      </View>
      {isAdmin && item.status === 'PENDING' && (
        <View style={styles.actionRow}>
          <Button title="Approve" onPress={() => handleApprove(item._id)} style={styles.actionBtn} />
          <Button title="Reject" onPress={() => setRejectModal(item._id)} variant="danger" style={styles.actionBtn} />
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={['bottom']}>
      <FlatList
        data={requests}
        keyExtractor={i => i._id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRequests(); }} tintColor={theme.primary} />}
        ListEmptyComponent={<View style={styles.empty}><Text style={[styles.emptyText, { color: theme.textMuted }]}>{loading ? 'Loading...' : 'No requests found'}</Text></View>}
        renderItem={renderItem}
      />
      <Modal transparent visible={!!rejectModal} animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Reject Request</Text>
            <TextInput style={[styles.reasonInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]} placeholder="Reason for rejection..." placeholderTextColor={theme.textMuted} value={rejectReason} onChangeText={setRejectReason} multiline />
            <View style={styles.modalBtns}>
              <Button title="Cancel" onPress={() => { setRejectModal(null); setRejectReason(''); }} variant="outline" style={{ flex: 1 }} />
              <Button title="Reject" onPress={handleReject} variant="danger" style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  card: { borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  name: { fontSize: font.lg, fontWeight: '700', flex: 1 },
  desc: { fontSize: font.sm, lineHeight: 20 },
  meta: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  metaText: { fontSize: font.sm },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  actionBtn: { flex: 1 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: font.lg },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.lg },
  modalBox: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, borderWidth: 1 },
  modalTitle: { fontSize: font.xl, fontWeight: '700' },
  reasonInput: { borderRadius: radius.md, padding: spacing.md, borderWidth: 1, minHeight: 80, textAlignVertical: 'top' },
  modalBtns: { flexDirection: 'row', gap: spacing.sm },
});
