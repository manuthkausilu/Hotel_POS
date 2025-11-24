import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Alert, Pressable } from 'react-native';
import { getDeviceTokens, sendTestNotification } from '../services/notificationService';
import { DeviceToken } from '../types/Notification';

const NotificationList: React.FC = () => {
  const [tokens, setTokens] = useState<DeviceToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const data = await getDeviceTokens();
        setTokens(data);
      } catch (error) {
        Alert.alert('Error', 'Failed to load device tokens');
      } finally {
        setLoading(false);
      }
    };
    fetchTokens();
  }, []);

  const handleSendTest = async () => {
    setSending(true);
    try {
      await sendTestNotification();
      Alert.alert('Success', 'Test notification sent!');
    } catch (error) {
      Alert.alert('Error', 'Failed to send test notification');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" style={styles.center} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Device Tokens</Text>
      <Pressable style={[styles.button, sending && styles.buttonDisabled]} onPress={handleSendTest} disabled={sending}>
        <Text style={styles.buttonText}>{sending ? 'Sending...' : 'Send Test Notification'}</Text>
      </Pressable>
      <FlatList
        data={tokens}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text>ID: {item.id}</Text>
            <Text>Device Type: {item.device_type}</Text>
            <Text>Active: {item.is_active ? 'Yes' : 'No'}</Text>
            <Text>Created: {new Date(item.created_at).toLocaleDateString()}</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  button: { backgroundColor: '#C084FC', padding: 12, borderRadius: 8, marginBottom: 20, alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#ccc' },
  buttonText: { color: 'white', fontWeight: 'bold' },
  item: { padding: 10, borderBottomWidth: 1, borderColor: '#ccc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

export default NotificationList;
