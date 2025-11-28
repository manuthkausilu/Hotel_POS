import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, Alert } from 'react-native';
import { normalizePayload, notificationHistoryService } from '../../../services/notificationHistoryService';
import type { NotificationHistory } from '../../../types/Notification';
import { onNotificationSaved } from '../../../services/notificationService';
import { useNotifications } from '../../../context/NotificationContext';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationHistory[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { clearAll } = useNotifications();

  const handleClearAll = () => {
    Alert.alert('Confirm', 'Clear all notification history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            await notificationHistoryService.clearAll();
            setNotifications([]);
            setSelectedId(null);
          } catch {
            Alert.alert('Error', 'Failed to clear history.');
          }
        },
      },
    ]);
  };

  const refresh = async () => {
    try {
      setRefreshing(true);
      const list = await notificationHistoryService.getNotifications();
      // ensure UI gets normalized titles/bodies (handles legacy shapes)
      const normalized = (list as any[]).map((i) => {
        const n = normalizePayload(i);
        return { ...i, title: i.title ?? n.title ?? 'No title', body: i.body ?? n.body ?? '', data: i.data ?? n.data };
      });
      setNotifications(normalized as NotificationHistory[]);
      setSelectedId(null);
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    refresh();

    // subscribe to saved notification events so this screen updates live
    const handleSaved = (rawItem: NotificationHistory) => {
      const n = normalizePayload(rawItem);
      const item = { ...rawItem, title: rawItem.title ?? n.title ?? 'No title', body: rawItem.body ?? n.body ?? '', data: rawItem.data ?? n.data };
      setNotifications(prev => {
        if (prev.some(p => p.id === item.id)) return prev;
        return [item, ...prev];
      });
    };
    const unsub = onNotificationSaved(handleSaved);

    return () => {
      // cleanup subscription
      try { unsub(); } catch { /* ignore */ }
    };
  }, []);

  const deleteNotification = async (id: string) => {
    try {
      await notificationHistoryService.deleteNotification(id);
      setNotifications((prev) => prev.filter((i) => i.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch {
      // ignore
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await notificationHistoryService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((i) => (i.id === id ? { ...i, is_read: true } : i))
      );
      setSelectedId(id);
    } catch {
      // ignore
    }
  };

  const renderItem = ({ item }: { item: NotificationHistory }) => (
    <Pressable
      onPress={() => markAsRead(item.id)}
      style={[styles.item, item.is_read ? styles.read : styles.unread]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{item.title ?? 'No title'}</Text>
        <Text style={styles.body}>{item.body ?? ''}</Text>
      </View>
      <View style={styles.actions}>
        {selectedId === item.id && (
          <Pressable
            onPress={() => deleteNotification(item.id)}
            style={[styles.actionButton, { backgroundColor: '#FF6B6B' }]}
          >
            <Text style={[styles.actionText, { color: 'white' }]}>Delete</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={{ padding: 12, flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Pressable style={[styles.actionButton, { backgroundColor: '#FF6B6B' }]} onPress={handleClearAll}>
          <Text style={[styles.actionText, { color: 'white' }]}>Clear All</Text>
        </Pressable>
      </View>
      {notifications.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No notifications</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#9ca3af' },
  item: {
    flexDirection: 'row',
    padding: 12,
    marginVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
  },
  unread: { backgroundColor: '#FFF7F7' },
  read: { backgroundColor: '#F7F7F7' },
  title: { fontWeight: '700', marginBottom: 4 },
  body: { color: '#6b7280' },
  meta: { marginTop: 6, fontSize: 11, color: '#9ca3af' },
  actions: { marginLeft: 12, alignItems: 'flex-end' },
  actionButton: { padding: 8, marginVertical: 4, backgroundColor: '#F3F4F6', borderRadius: 8 },
  actionText: { color: '#374151', fontWeight: '600' },
});
