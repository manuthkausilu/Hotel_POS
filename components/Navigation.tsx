import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Drawer({ isOpen, onClose }: DrawerProps) {
  const router = useRouter();
  const { user, logout } = useAuth();

  const menuItems = [
    { icon: 'home-outline', label: 'Dashboard', route: '/' },
    { icon: 'restaurant-outline', label: 'Menu', route: '../menu' },
  ];

  const handleNavigate = (route: any) => {
    onClose();
    if (route !== '/') {
      setTimeout(() => {
        router.push(route);
      }, 300);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to log out?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: async () => {
            await logout();
            onClose();
            router.replace('/login');
          },
        },
      ],
      { cancelable: true }
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={styles.drawer}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="business-outline" size={36} color="white" />
            </View>
            <Text style={styles.appName}>POS SYSTEM</Text>
            {user && (
              <View style={styles.userInfo}>
                <Ionicons name="person-circle-outline" size={20} color="white" style={styles.userIcon} />
                <View style={styles.userTextContainer}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {user.name || user.email}
                  </Text>
                  <Text style={styles.userRole}>User Name</Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.menuSection}>
            <Text style={styles.sectionTitle}>MAIN MENU</Text>
            {menuItems.map((item, index) => (
              <Pressable
                key={index}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && styles.menuItemPressed,
                ]}
                onPress={() => handleNavigate(item.route)}
              >
                <View style={styles.menuIconContainer}>
                  <Ionicons name={item.icon as any} size={22} color="#FF6B6B" />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.footer}>
            <Pressable 
              style={({ pressed }) => [
                styles.logoutButton,
                pressed && styles.logoutButtonPressed,
              ]}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={20} color="#DC2626" />
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 280,
    backgroundColor: 'white',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#FF6B6B',
    padding: 24,
    paddingTop: 48,
    paddingBottom: 28,
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  appName: {
    fontSize: 24,
    fontWeight: '800',
    color: 'white',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  userInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userIcon: {
    marginRight: 12,
  },
  userTextContainer: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  menuSection: {
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1.2,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginHorizontal: 12,
    marginVertical: 2,
    borderRadius: 10,
  },
  menuItemPressed: {
    backgroundColor: '#F9FAFB',
  },
  menuIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF1F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    padding: 16,
    marginTop: 'auto',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFF1F1',
    borderRadius: 10,
    gap: 8,
  },
  logoutButtonPressed: {
    backgroundColor: '#FFECEC',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF6B6B',
  },
});
