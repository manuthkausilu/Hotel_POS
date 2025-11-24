import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Drawer from '../components/Navigation';
import { useAuth } from '../context/AuthContext';
import NotificationList from '../components/Notification';

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

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
          <Ionicons name="menu" size={38} color="#C084FC" />
        </Pressable>
        <Text style={styles.topBarTitle}>Dashboard</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.backgroundCircle1} />
      <View style={styles.backgroundCircle2} />
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>POS</Text>
          <Text style={styles.subtitle}>Management System</Text>
        </View>
        
        {user && (
          <View style={styles.userCard}>
            <View style={styles.userIconWrapper}>
              <Ionicons name="person" size={24} color="white" />
            </View>
            <View style={styles.userTextContainer}>
              <Text style={styles.welcomeText}>Welcome back</Text>
              <Text style={styles.userName}>
                {user.name || user.email}
              </Text>
            </View>
          </View>
        )}
      </View>

      <NotificationList />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F3FF',
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
  placeholder: {
    width: 44,
  },
  backgroundCircle1: {
    position: 'absolute',
    width: 500,
    height: 500,
    borderRadius: 250,
    backgroundColor: 'rgba(196, 181, 253, 0.12)',
    top: -200,
    right: -100,
  },
  backgroundCircle2: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(221, 214, 254, 0.15)',
    bottom: -150,
    left: -100,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 32,
    padding: 40,
    margin: 24,
    marginTop: 40,
    shadowColor: '#C084FC',
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
    backgroundColor: '#C084FC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userTextContainer: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 12,
    color: '#C084FC',
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
    backgroundColor: '#C084FC',
    padding: 18,
    borderRadius: 16,
    shadowColor: '#C084FC',
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
});
