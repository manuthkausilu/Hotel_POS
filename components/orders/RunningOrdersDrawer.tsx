import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, TouchableWithoutFeedback, StyleSheet } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  runningOrders: any[];
  runningLoading: boolean;
  runningError: string | null;
  onRefresh: () => void;
  onCancelPress: (id: number) => void;
  onEditPress: (id: number) => void;
  onFinalizePress: (id: number, total?: number) => void;
  onSplitPress: (id: number) => void;
  currencyLabel: string;
  formatDateTime: (iso?: string) => string;
  customerFullName: (o: any) => string;
  roomLabel: (ri?: any) => string;
};

export default function RunningOrdersDrawer({
  visible,
  onClose,
  runningOrders,
  runningLoading,
  runningError,
  onRefresh,
  onCancelPress,
  onEditPress,
  onFinalizePress,
  onSplitPress,
  currencyLabel,
  formatDateTime,
  customerFullName,
  roomLabel,
}: Props) {
  if (!visible) return null;

  return (
    <>
      <TouchableOpacity style={styles.ongoingOverlay} activeOpacity={1} onPress={onClose} />
      <View style={[styles.ongoingDrawer, styles.ongoingDrawerOpen]}>
        <View style={styles.ongoingHeader}>
          <Text style={styles.ongoingTitle}>Running Orders</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {runningLoading && <Text>Loading...</Text>}
          {runningError && <Text style={{ color: 'red' }}>{runningError}</Text>}
          {!runningLoading && (!runningOrders || runningOrders.length === 0) && <Text style={{ color: '#6B7280' }}>No running orders</Text>}

          {runningOrders.map((o: any) => (
            <View key={String(o.id)} style={styles.ongoingOrderCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontWeight: '800' }}>#{o.id}</Text>
                <Text style={{ color: '#FF6B6B', fontWeight: '800' }}>{currencyLabel}{Number(o.total).toFixed(2)}</Text>
              </View>

              {o.created_at ? <Text style={{ color: '#6B7280', marginBottom: 6 }}>{formatDateTime(o.created_at)}</Text> : null}
              {o.customer_name ? <Text style={{ marginBottom: 4 }}>Customer: {customerFullName(o)}</Text> : null}
              {o.room_number ? <Text style={{ marginBottom: 4 }}>Room: {o.room_number}</Text> : null}
              {o.table_id ? <Text style={{ marginBottom: 4 }}>Table: {o.table_id}</Text> : null}
              {o.steward_name ? <Text style={{ marginBottom: 4 }}>Steward: {o.steward_name}</Text> : null}

              {typeof o.is_ready !== 'undefined' && o.is_ready !== null ? (
                <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                  <View style={[styles.ongoingStatusBadge, { backgroundColor: o.is_ready ? '#D1FAE5' : '#FEF3C7' }]}>
                    <Text style={{ color: o.is_ready ? '#065F46' : '#92400E', fontWeight: '700' }}>
                      {o.is_ready ? 'Ready' : 'Not Ready'}
                    </Text>
                  </View>
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 8 }}>
                <TouchableOpacity
                  style={[styles.ongoingActionBtn, { borderColor: '#FCA5A5', backgroundColor: '#FFF1F2' }]}
                  onPress={() => onCancelPress(o.id)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.ongoingActionText, { color: '#B91C1C' }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.ongoingActionBtn, { borderColor: '#FBBF24', backgroundColor: '#FFFBEB' }]}
                  onPress={() => onEditPress(o.id)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.ongoingActionText, { color: '#92400E' }]}>Update</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.ongoingActionBtn, { borderColor: '#86EFAC', backgroundColor: '#ECFDF5' }]}
                  onPress={() => onFinalizePress(o.id, o.total)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.ongoingActionText, { color: '#065F46' }]}>Finalize</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.ongoingActionBtn, { borderColor: '#A5B4FC', backgroundColor: '#EEF2FF' }]}
                  onPress={() => onSplitPress(o.id)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.ongoingActionText, { color: '#4338CA' }]}>Split</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            style={[styles.ongoingActionBtn, styles.refreshBtn]}
            onPress={onRefresh}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Refresh running orders"
          >
            <Text style={[styles.ongoingActionText, styles.refreshBtnText]}>Refresh</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ongoingActionBtn, styles.closeBtn]}
            onPress={onClose}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Close running orders"
          >
            <Text style={[styles.ongoingActionText, styles.closeBtnText]}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  ongoingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 900,
  },
  ongoingDrawer: {
    position: 'absolute',
    top: 0, right: 0,
    height: '100%',
    width: 360,
    maxWidth: '100%',
    backgroundColor: '#fff',
    zIndex: 950,
    shadowColor: '#000',
    shadowOffset: { width: -6, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#F3F4F6',
  },
  ongoingDrawerOpen: { transform: [{ translateX: 0 }] },
  ongoingHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ongoingTitle: { fontWeight: '800', fontSize: 16 },
  ongoingOrderCard: { borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 10, padding: 12, marginBottom: 12, backgroundColor: '#FFFFFF' },
  ongoingStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignItems: 'center' },
  ongoingActionBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  ongoingActionText: { color: '#111827', fontWeight: '700' },
  refreshBtn: { backgroundColor: '#111827', borderColor: '#111827' },
  refreshBtnText: { color: '#FFFFFF' },
  closeBtn: { backgroundColor: '#FF6B6B', borderColor: '#FF6B6B' },
  closeBtnText: { color: '#FFFFFF' },
});
