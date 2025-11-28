import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationHistoryService } from '../../services/notificationHistoryService';
import type { NotificationHistory } from '../../types/Notification';

export default function AsyncStorageDebugScreen() {
  const [raw, setRaw] = useState<string | null>(null);
  const [list, setList] = useState<NotificationHistory[]>([]);
  const [loading, setLoading] = useState(false);

  // helper: safe JSON parse
  const tryParse = (v: any) => {
    try {
      return typeof v === 'string' ? JSON.parse(v) : v;
    } catch {
      return null;
    }
  };

  // helper: pick first non-null/undefined from list
  const first = (...vals: any[]) => {
    for (const v of vals) if (v !== null && v !== undefined) return v;
    return undefined;
  };

  // normalize a stored item into predictable title/body
  const normalizeItem = (item: any) => {
    const maybeData = tryParse(item.data);
    const maybeMessage = item.message ?? tryParse(item.message);
    const maybeNotification = item.notification ?? maybeMessage?.notification ?? tryParse(item.notification);

    const title = first(
      item.title,
      maybeNotification?.title,
      item.notification?.title,
      maybeMessage?.notification?.title,
      maybeData?.title,
      maybeData?.notification?.title
    ) ?? 'No title';

    const body = first(
      item.body,
      maybeNotification?.body,
      item.notification?.body,
      maybeMessage?.notification?.body,
      maybeData?.body
    ) ?? '';

    return { ...item, title, body };
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await AsyncStorage.getItem('@notification_history');

      // try to pretty-print raw storage for easier inspection
      if (r) {
        try {
          setRaw(JSON.stringify(JSON.parse(r), null, 2));
        } catch {
          setRaw(r);
        }
      } else {
        setRaw(null);
      }

      const parsed = await notificationHistoryService.getNotifications();
      // normalize multiple possible shapes so UI shows actual values if present
      const normalized = (parsed as any[]).map(normalizeItem);
      setList(normalized as NotificationHistory[]);
    } catch (err) {
      Alert.alert('Error', 'Failed to read AsyncStorage.');
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    Alert.alert('Confirm', 'Clear all notification history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            await notificationHistoryService.clearAll();
            await refresh();
            Alert.alert('Cleared', 'Notification history cleared.');
          } catch {
            Alert.alert('Error', 'Failed to clear history.');
          }
        },
      },
    ]);
  };

  const logRaw = () => {
    console.log('AsyncStorage @notification_history raw:', raw);
    // also log parsed JSON if possible
    try {
      if (raw) {
        console.log('Parsed JSON:', JSON.parse(raw));
      }
    } catch {
      // not JSON — ignore
    }
    Alert.alert('Logged', 'Raw value logged to console.');
  };

  useEffect(() => {
    refresh();
  }, []);

  const renderItem = ({ item }: { item: NotificationHistory }) => (
    <View style={styles.item}>
      <Text style={styles.title}>{item.title ?? 'No title'}</Text>
      <Text style={styles.body}>{item.body ?? ''}</Text>
      <Text style={styles.meta}>{`id: ${item.id} • created: ${new Date(item.created_at).toLocaleString()} • read: ${item.is_read}`}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <Pressable style={styles.btn} onPress={refresh}>
          <Text style={styles.btnText}>{loading ? 'Refreshing...' : 'Refresh'}</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.danger]} onPress={clearHistory}>
          <Text style={[styles.btnText, { color: 'white' }]}>Clear History</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={logRaw}>
          <Text style={styles.btnText}>Log Raw</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Parsed notifications ({list.length})</Text>
        <FlatList data={list} keyExtractor={(i) => i.id} renderItem={renderItem} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Raw @notification_history</Text>
        <ScrollView style={styles.rawBox}>
          <Text style={styles.rawText}>{raw ?? 'null'}</Text>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, paddingTop: 48, backgroundColor: '#fff' },
  controls: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  btn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  danger: { backgroundColor: '#FF6B6B' },
  btnText: { fontWeight: '700', color: '#111827' },
  section: { marginTop: 12 },
  sectionTitle: { fontWeight: '700', marginBottom: 8 },
  rawBox: { maxHeight: 220, borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 8, backgroundColor: '#FAFAFA' },
  rawText: { fontSize: 12, color: '#374151' },
  item: { padding: 10, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  title: { fontWeight: '700' },
  body: { color: '#6b7280' },
  meta: { marginTop: 6, fontSize: 11, color: '#9ca3af' },
});
