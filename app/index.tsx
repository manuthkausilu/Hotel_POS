import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, Alert } from 'react-native';
import Drawer from '../components/Navigation';
import { useAuth } from '../context/AuthContext';
import OrdersScreen from './(tabs)/orders';
import { NotificationProvider, useNotifications } from '../context/NotificationContext';
import { registerFcmTokenAndStore, initNotificationListeners } from '../services/notificationService';

// NotificationModal: renders notification history inside a modal-like full-screen overlay
const NotificationModal: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => {
	// lightweight import of hooks from the notification context
	const { notifications, refresh, deleteNotification, markAsRead, clearAll } = useNotifications();
	const [selectedId, setSelectedId] = useState<string | null>(null);

	useEffect(() => {
		if (visible) refresh();
		if (!visible) setSelectedId(null);
	}, [visible]);

	return (
		// simple full-screen overlay; keep it inside this file to avoid new files
		// use a basic View overlay (not RN Modal) for compatibility with expo-router stacks
		visible ? (
			<View style={styles.modalOverlay}>
				<View style={styles.modalCard}>
					<View style={styles.modalHeader}>
						<Text style={styles.modalTitle}>Notifications</Text>
						<Pressable onPress={() => {
							// confirm clear all
							Alert.alert('Confirm', 'Clear all notification history?', [
								{ text: 'Cancel', style: 'cancel' },
								{ text: 'Clear', style: 'destructive', onPress: async () => { await clearAll(); } },
							]);
						}} style={{ padding: 8 }}>
							<Text style={{ color: '#FF6B6B', fontWeight: '700' }}>Clear All</Text>
						</Pressable>
						<Pressable onPress={() => { setSelectedId(null); onClose(); }} style={styles.modalClose}>
							<Ionicons name="close" size={22} color="#374151" />
						</Pressable>
					</View>

					{notifications.length === 0 ? (
						<View style={styles.empty}>
							<Text style={styles.emptyText}>No notifications</Text>
						</View>
					) : (
						<React.Fragment>
							{notifications.map((item) => (
								<Pressable
									key={item.id}
									onPress={async () => {
										await markAsRead(item.id);
										setSelectedId(item.id);
									}}
									style={[styles.item, item.is_read ? styles.read : styles.unread]}
								>
									<View style={{ flex: 1 }}>
										<Text style={styles.title}>{item.title ?? 'No title'}</Text>
										<Text style={styles.body}>{item.body ?? ''}</Text>
										<Text style={styles.meta}>Expires: {new Date(item.expires_at).toLocaleString()}</Text>
									</View>
									<View style={styles.actions}>
										{selectedId === item.id && (
											<Pressable onPress={async () => { await deleteNotification(item.id); setSelectedId(null); }} style={[styles.actionButton, { backgroundColor: '#FF6B6B' }]}>
												<Text style={[styles.actionText, { color: 'white' }]}>Delete</Text>
											</Pressable>
										)}
									</View>
								</Pressable>
							))}
						</React.Fragment>
					)}
				</View>
			</View>
		) : null
	);
};

// add this child component (inside this file) so it can consume the NotificationProvider below
const NotificationBell: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
	const { notifications } = useNotifications();
	const unread = notifications.some(n => !n.is_read);

	return (
		<Pressable onPress={onOpen} style={styles.bellButton}>
			<Ionicons name="notifications" size={28} color="#FF6B6B" />
			{unread && <View style={styles.badge} />}
		</Pressable>
	);
};

export default function HomeScreen() {
	const { user, logout } = useAuth();
	const router = useRouter();
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [modalVisible, setModalVisible] = useState(false);

	useEffect(() => {
		checkToken();

		// try to obtain native FCM token and register it with backend
		(async () => {
			try {
				const token = await registerFcmTokenAndStore();
				console.log('Push token (attempt):', token);
			} catch (err) {
				console.warn('Error registering push token:', err);
			}
		})();

		// register notification listeners early (persist incoming notifications)
		let cleanupNotifications: (() => void) | null = null;
		(async () => {
			try {
				cleanupNotifications = await initNotificationListeners();
			} catch {
				cleanupNotifications = null;
			}
		})();

		return () => {
			if (cleanupNotifications) cleanupNotifications();
		};
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
		<NotificationProvider>
			<View style={styles.container}>
				<Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
				
				<View style={styles.topBar}>
					<Pressable style={styles.menuButton} onPress={() => setDrawerOpen(true)}>
						<Ionicons name="menu" size={38} color="#FF6B6B" />
					</Pressable>
					<Text style={styles.topBarTitle}>Trackerstay</Text>
					{/* notification bell */}
					<View style={styles.rightControls}>
						{/* toggles in-place modal */}
						<NotificationBell onOpen={() => setModalVisible(true)} />
					</View>
				</View>

{/* OrdersScreen: displays menu items, cart UI and order submission modal.................... */}
				<View style={{ flex: 1 }}>
					<OrdersScreen />
				</View>
{/* .......................................................................................... */}
				{/* Notification Modal overlay */}
				<NotificationModal visible={modalVisible} onClose={() => setModalVisible(false)} />
			</View>
		</NotificationProvider>
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
	titleLarge: {
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
	// add modal styles (keep concise)
	modalOverlay: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: 'rgba(0,0,0,0.35)',
		justifyContent: 'center',
		alignItems: 'center',
		zIndex: 50,
	},
	modalCard: {
		width: '92%',
		maxHeight: '80%',
		backgroundColor: '#fff',
		borderRadius: 16,
		padding: 12,
	},
	modalHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 8,
	},
	modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
	modalClose: { padding: 6 },
	// reuse notification list styles (kept brief here)
	empty: { padding: 20, alignItems: 'center' },
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
