import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationHistoryService } from '../../services/notificationHistoryService';
import type { NotificationHistory } from '../../types/Notification';

export default function AsyncStorageDebugScreen() {
  const [raw, setRaw] = useState<string | null>(null);
  const [list, setList] = useState<NotificationHistory[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await AsyncStorage.getItem('@notification_history');
      setRaw(r);
      const parsed = await notificationHistoryService.getNotifications();
      setList(parsed);
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
