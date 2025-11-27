import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Drawer from '../components/Navigation';
import { useAuth } from '../context/AuthContext';
import OrdersScreen from './(tabs)/orders';

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hasBadge, setHasBadge] = useState(true); // new: controls small red dot

  useEffect(() => {
    checkToken();
  }, []);

  const checkToken = async () => {
    const token = await AsyncStorage.getItem('@auth_token');
    console.log('🏠 Home Screen - Current Token:', token);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
      
      <View style={styles.topBar}>
        <Pressable style={styles.menuButton} onPress={() => setDrawerOpen(true)}>
          <Ionicons name="menu" size={38} color="#FF6B6B" />
        </Pressable>
        <Text style={styles.topBarTitle}>Trackerstay</Text>
        {/* notification bell */}
        <View style={styles.rightControls}>
          <Pressable
            onPress={() => { console.log('Notifications pressed'); setHasBadge(false); }}
            style={styles.bellButton}
          >
            <Ionicons name="notifications" size={28} color="#FF6B6B" />
            {hasBadge && <View style={styles.badge} />}
          </Pressable>
        </View>
      </View>
{/* OrdersScreen: displays menu items, cart UI and order submission modal.................... */}
      <View style={{ flex: 1 }}>
        <OrdersScreen />
      </View>
{/* .......................................................................................... */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 48,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  menuButton: {
    padding: 8,
  },
  topBarTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  rightControls: {
    width: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  bellButton: {
    padding: 6,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B6B',
  },
  backgroundCircle1: {
    position: 'absolute',
    width: 500,
    height: 500,
    borderRadius: 250,
    backgroundColor: 'rgba(255,107,107,0.08)',
    top: -200,
    right: -100,
  },
  backgroundCircle2: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(255,107,107,0.06)',
    bottom: -150,
    left: -100,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 32,
    padding: 40,
    margin: 24,
    marginTop: 40,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  userCard: {
    backgroundColor: '#FAF5FF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 28,
    borderWidth: 2,
    borderColor: '#F3E8FF',
    flexDirection: 'row',
    alignItems: 'center',
  },
  userIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userTextContainer: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 12,
    color: '#FF6B6B',
    marginBottom: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  logoutButton: {
    backgroundColor: '#FF6B6B',
    padding: 18,
    borderRadius: 16,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  logoutText: {
    color: 'white',
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 17,
    letterSpacing: 0.5,
  },
  navBox: {
    backgroundColor: '#FFF1F1',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginTop: 20,
  },
  navText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 8,
  },
});
