import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { notificationHistoryService } from '../../../services/notificationHistoryService';
import type { NotificationHistory } from '../../../types/Notification';
import { onNotificationSaved } from '../../../services/notificationService';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationHistory[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    try {
      setRefreshing(true);
      const list = await notificationHistoryService.getNotifications();
      setNotifications(list);
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    refresh();

    // subscribe to saved notification events so this screen updates live
    const handleSaved = (item: NotificationHistory) => {
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
    } catch {
      // ignore
    }
  };

  const renderItem = ({ item }: { item: NotificationHistory }) => (
    <View style={[styles.item, item.is_read ? styles.read : styles.unread]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{item.title ?? 'No title'}</Text>
        <Text style={styles.body}>{item.body ?? ''}</Text>
        <Text style={styles.meta}>
          Expires: {new Date(item.expires_at).toLocaleString()}
        </Text>
      </View>
      <View style={styles.actions}>
        {!item.is_read && (
          <Pressable onPress={() => markAsRead(item.id)} style={styles.actionButton}>
            <Text style={styles.actionText}>Mark</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => deleteNotification(item.id)}
          style={[styles.actionButton, { backgroundColor: '#FF6B6B' }]}
        >
          <Text style={[styles.actionText, { color: 'white' }]}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
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
