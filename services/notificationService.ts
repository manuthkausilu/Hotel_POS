import { apiClient } from './apiClient';
import { DeviceToken } from '../types/Notification';
import { notificationHistoryService } from './notificationHistoryService';
import { Platform, Alert } from 'react-native';

export const destroyDeviceToken = async () => {
  try {
    const response = await apiClient.delete('/user/device-token');
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Store device token but refuse Expo tokens (ExponentPushToken).
// If an Expo token is passed, do a best-effort backend cleanup and return null.
export const storeDeviceToken = async (deviceToken: string, appType = 'pos_system') => {
  // refuse Expo push tokens — we only want native FCM tokens stored
  if (typeof deviceToken === 'string' && deviceToken.startsWith('ExponentPushToken')) {
    console.warn('Refusing to store Expo push token on backend. Attempting cleanup of any existing token.');
    try {
      // best-effort remove any stored token for this user
      await destroyDeviceToken();
      console.log('Attempted to remove Expo device token from backend (best-effort).');
    } catch (err) {
      console.warn('Failed to remove Expo token from backend during cleanup:', err);
    }
    return null;
  }

  try {
    const response = await apiClient.post('/user/device-token', { 
      device_token: deviceToken,
      device_type: Platform.OS === 'ios' ? 'ios' : 'android',
      app_type: appType, // new: send app_type to backend
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getDeviceTokens = async (): Promise<DeviceToken[]> => {
  try {
    const response = await apiClient.get('/user/device-tokens');
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const sendTestNotification = async () => {
  try {
    const response = await apiClient.post('/notifications/test');
    return response.data;
  } catch (error) {
    throw error;
  }
};

// New internal helper: returns token + flag if token is Expo's token.
// Important: do NOT treat Expo push tokens as valid FCM tokens for backend registration.
const getFcmTokenInternal = async (): Promise<{ token: string | null; isExpo: boolean }> => {
  // try RNFirebase messaging (native FCM)
  try {
    // dynamic import avoids crash if package isn't installed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const messagingModule: any = await import('@react-native-firebase/messaging');
    // instantiate the messaging module (module() or default())
    const messagingInstance: any =
      typeof messagingModule === 'function'
        ? messagingModule()
        : (messagingModule.default ? messagingModule.default() : messagingModule);
    const fcmToken = await messagingInstance.getToken();
    if (fcmToken) return { token: fcmToken, isExpo: false };
  } catch {
    // ignore and fallback
  }

  // fallback: expo-notifications (may return Expo token or native token depending on build)
  try {
    const Notifications = await import('expo-notifications');
    const tokenResp: any = await Notifications.getDevicePushTokenAsync();
    const token = tokenResp?.data ?? tokenResp?.token ?? null;
    if (!token) return { token: null, isExpo: false };
    const isExpo = typeof token === 'string' && token.startsWith('ExponentPushToken');
    return { token, isExpo };
  } catch {
    return { token: null, isExpo: false };
  }
};

// Public: register token with backend, but skip Expo tokens.
// If an Expo token is detected, attempt to remove any existing token on backend (best-effort),
// and return null so callers know nothing was stored.
export const registerFcmTokenAndStore = async (appType = 'pos_system'): Promise<string | null> => {
  const { token, isExpo } = await getFcmTokenInternal();

  if (!token) {
    console.warn('No push token obtained (native FCM or expo).');
    return null;
  }

  if (isExpo) {
    console.warn('Obtained ExponentPushToken — refusing to register Expo token. Configure native FCM or use react-native-firebase.');
    // best-effort: ensure backend does not keep an Expo token for this user
    try {
      await destroyDeviceToken();
      console.log('Attempted to remove Expo device token from backend (best-effort).');
    } catch (err) {
      console.warn('Failed to remove Expo token from backend during cleanup:', err);
    }
    return null;
  }

  try {
    await storeDeviceToken(token, appType); // pass app_type through
    console.log('Device token registered with backend:', token);
    return token;
  } catch (err) {
    console.warn('Failed to store device token on backend:', err);
    return null;
  }
};

let _listenersRegistered = false;

// Notification saved callbacks (moved to module scope)
type NotificationSavedCallback = (item: any) => void;
const _savedCallbacks = new Set<NotificationSavedCallback>();

// Helper to emit saved notification to all listeners
const emitSaved = (item: any) => {
  _savedCallbacks.forEach(cb => {
	try {
	  cb(item);
	} catch (err) {
	  // Ignore errors in individual callbacks
	  console.warn('Error in notification saved callback:', err);
	}
  });
};

export const onNotificationSaved = (cb: NotificationSavedCallback) => {
  _savedCallbacks.add(cb);
  return () => _savedCallbacks.delete(cb);
};
export const offNotificationSaved = (cb: NotificationSavedCallback) => {
  _savedCallbacks.delete(cb);
};

/**
 * Initialize notification listeners (expo-notifications) once.
 * Returns a cleanup function to remove listeners.
 */
export const initNotificationListeners = async (): Promise<() => void> => {
	// avoid multiple registrations
	if (_listenersRegistered) return () => {};
	try {
		const Notifications: any = await import('expo-notifications');

		// ensure notifications are shown in foreground
		if (typeof Notifications.setNotificationHandler === 'function') {
			Notifications.setNotificationHandler({
				handleNotification: async () => ({
					shouldShowAlert: true,
					shouldPlaySound: false,
					shouldSetBadge: false,
				}),
			});
		}

		// Create Android channel for heads-up notifications (pop-up)
		try {
			if (Platform.OS === 'android' && typeof Notifications.setNotificationChannelAsync === 'function') {
				await Notifications.setNotificationChannelAsync('default', {
					name: 'Default',
					importance: Notifications.AndroidImportance.MAX ?? 5,
					sound: 'default',
					vibrationPattern: [0, 250, 250, 250],
					lightColor: '#FF6B6B',
				});
			}
		} catch {
			// ignore channel creation errors
		}

		const receivedSub = Notifications?.addNotificationReceivedListener?.(async (notif: any) => {
			try {
				const content = notif?.request?.content ?? {};
				const title = content.title ?? undefined;
				const body = content.body ?? undefined;
				const data = content.data ?? undefined;
				const item = await notificationHistoryService.addNotification({ title, body, data });

				// emit to subscribers (NotificationProvider will update UI)
				emitSaved(item);

				// present a local/system notification to ensure pop-up (foreground)
				try {
					await Notifications.presentNotificationAsync({
						title: item.title ?? undefined,
						body: item.body ?? undefined,
						data: item.data ?? undefined,
						android: {
							channelId: 'default',
							priority: 'max',
						},
						ios: {
							sound: 'default',
						},
					});
				} catch {
					// ignore present errors
				}

				// optional user feedback
				Alert.alert('Notification saved', item.title ?? 'A notification was saved to history.');
			} catch (err) {
				Alert.alert('Notification not saved', 'Failed to save incoming notification.');
			}
		});

		const responseSub = Notifications?.addNotificationResponseReceivedListener?.(async (response: any) => {
			try {
				const content = response?.notification?.request?.content ?? {};
				const title = content.title ?? undefined;
				const body = content.body ?? undefined;
				const data = content.data ?? undefined;
				const item = await notificationHistoryService.addNotification({ title, body, data });

				// emit to subscribers (NotificationProvider will update UI)
				emitSaved(item);

				// when user taps, optionally present (usually not needed) — kept for parity
				try {
					await Notifications.presentNotificationAsync({
						title: item.title ?? undefined,
						body: item.body ?? undefined,
						data: item.data ?? undefined,
						android: { channelId: 'default', priority: 'max' },
						ios: { sound: 'default' },
					});
				} catch {
					// ignore
				}

				Alert.alert('Notification saved', item.title ?? 'A notification was saved to history.');
			} catch (err) {
				Alert.alert('Notification not saved', 'Failed to save notification response.');
			}
		});

		_listenersRegistered = true;
		return () => {
			if (receivedSub && typeof receivedSub.remove === 'function') receivedSub.remove();
			if (responseSub && typeof responseSub.remove === 'function') responseSub.remove();
			_listenersRegistered = false;
		};
	} catch {
		// expo-notifications not available
		return () => {};
	}
};
