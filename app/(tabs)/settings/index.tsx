import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Drawer from '../../../components/Navigation';
import { authService } from '../../../services/authService';
import { User } from '../../../types/User';

export const unstable_settings = {
  headerShown: false,
};

export const screenOptions = {
  headerShown: false,
};


export default function SettingsScreen() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUser = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const u = await authService.getCurrentUser();
      setUser(u);
    } catch (e) {
      console.error(e);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUser();
    setRefreshing(false);
  }, [loadUser]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFF' }}>
      <Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <View style={styles.topBar}>
        <Pressable style={styles.menuButton} onPress={() => setDrawerOpen(true)}>
          <Ionicons name="menu" size={26} color="#C084FC" />
        </Pressable>
        <Text style={styles.topBarTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Ionicons name="settings-outline" size={28} color="#7C3AED" />
          <Text style={styles.title}>Settings</Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {user ? (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>ID</Text>
              <Text style={styles.value}>{user.id ?? '-'}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>First Name</Text>
              <Text style={styles.value}>{user.name ?? '-'}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Last Name</Text>
              <Text style={styles.value}>{user.lname ?? '-'}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{user.email ?? '-'}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Email Verified</Text>
              <Text style={styles.value}>{user.email_verified_at ? 'Yes' : 'No'}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Created At</Text>
              <Text style={styles.value}>{user.created_at ?? '-'}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Updated At</Text>
              <Text style={styles.value}>{user.updated_at ?? '-'}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Status</Text>
              <Text style={styles.value}>{user.status ?? '-'}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Role</Text>
              <Text style={styles.value}>{user.role ?? '-'}</Text>
            </View>

            <View style={styles.actionsRow}>
              <Pressable style={[styles.actionButton, styles.secondary]} onPress={onRefresh}>
                <Ionicons name="refresh" size={18} color="#7C3AED" />
                <Text style={[styles.actionText, { color: '#7C3AED' }]}>Refresh</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No profile available</Text>
            <Pressable onPress={loadUser} style={styles.retry}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFF' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginLeft: 8 },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#F3F4F6' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  label: { color: '#9CA3AF', fontWeight: '700' },
  value: { color: '#0F172A', fontWeight: '700', maxWidth: '70%', textAlign: 'right' },
  actionsRow: { flexDirection: 'row', marginTop: 14, justifyContent: 'flex-end' },
  actionButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: '#7C3AED', marginLeft: 8 },
  actionText: { color: 'white', fontWeight: '700', marginLeft: 8 },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#EDE6FF', paddingHorizontal: 10 },
  empty: { alignItems: 'center', padding: 24 },
  emptyText: { color: '#94A3B8', marginBottom: 8 },
  retry: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#7C3AED', borderRadius: 8 },
  retryText: { color: 'white', fontWeight: '700' },
  errorBox: { backgroundColor: '#FEF3F2', padding: 10, borderRadius: 8, marginBottom: 12 },
  errorText: { color: '#B91C1C' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuButton: { padding: 6 },
  topBarTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  placeholder: { width: 40 },
});