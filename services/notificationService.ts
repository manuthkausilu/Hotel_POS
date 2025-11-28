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

// small helper to try parse JSON-ish values
const tryParse = (v: any) => {
  try {
    return typeof v === 'string' ? JSON.parse(v) : v;
  } catch {
    return null;
  }
};

// Extract sensible { title, body, data } from expo-notifications / FCM objects
const extractPayloadFromContent = (content: any) => {
  if (!content) return { title: undefined, body: undefined, data: undefined };

  const title = content.title ?? content?.notification?.title ?? undefined;
  const body = content.body ?? content?.notification?.body ?? undefined;

  // content.data may be an object or a JSON string; try to parse
  const rawData = content.data ?? content?.data ?? undefined;
  const parsedData = tryParse(rawData) ?? rawData;

  return { title, body, data: parsedData };
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

		// expo listeners (existing)
		const receivedSub = Notifications?.addNotificationReceivedListener?.(async (notif: any) => {
			try {
				const content = notif?.request?.content ?? {};
				const { title, body, data } = extractPayloadFromContent(content);

				// addNotification will further normalize and persist the item
				const item = await notificationHistoryService.addNotification({ title, body, data });

				// emit to subscribers (NotificationProvider will update UI)
				emitSaved(item);

				// present a local/system notification to ensure pop-up (foreground)
				try {
					await Notifications.presentNotificationAsync({
						title: item.title ?? undefined,
						body: item.body ?? undefined,
						data: item.data ?? undefined,
						android: { channelId: 'default', priority: 'max' },
						ios: { sound: 'default' },
					});
				} catch {
					// ignore present errors
				}

				// removed success Alert to avoid intrusive popup when notifications arrive
			} catch (err) {
				Alert.alert('Notification not saved', 'Failed to save incoming notification.');
			}
		});

		const responseSub = Notifications?.addNotificationResponseReceivedListener?.(async (response: any) => {
			try {
				const content = response?.notification?.request?.content ?? {};
				const { title, body, data } = extractPayloadFromContent(content);

				const item = await notificationHistoryService.addNotification({ title, body, data });

				// emit to subscribers (NotificationProvider will update UI)
				emitSaved(item);

				// optionally present as well (kept for parity)
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

				// removed success Alert to avoid intrusive popup when user taps a notification
			} catch (err) {
				Alert.alert('Notification not saved', 'Failed to save notification response.');
			}
		});

		// --- NEW: try to register react-native-firebase messaging handlers (FCM) ---
		let fcmOnMessageUnsub: (() => void) | null = null;
		let fcmOnNotificationOpenedUnsub: (() => void) | null = null;

		try {
			// dynamic import to avoid crash if package isn't installed
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const messagingModule: any = await import('@react-native-firebase/messaging');

			const messaging: any =
				typeof messagingModule === 'function'
					? messagingModule()
					: (messagingModule.default ? messagingModule.default() : messagingModule);

			if (messaging) {
				// foreground messages
				if (typeof messaging.onMessage === 'function') {
					fcmOnMessageUnsub = messaging.onMessage(async (remoteMessage: any) => {
						try {
							const content = remoteMessage?.notification ?? {};
							const title = content?.title ?? remoteMessage?.data?.title;
							const body = content?.body ?? remoteMessage?.data?.body;
							const data = remoteMessage?.data ?? {};
							const item = await notificationHistoryService.addNotification({ title, body, data });
							emitSaved(item);
						} catch {
							// ignore save errors
						}
					});
				}

				// background handler (runs when JS process handles background messages)
				if (typeof messaging.setBackgroundMessageHandler === 'function') {
					try {
						messaging.setBackgroundMessageHandler(async (remoteMessage: any) => {
							try {
								const content = remoteMessage?.notification ?? {};
								const title = content?.title ?? remoteMessage?.data?.title;
								const body = content?.body ?? remoteMessage?.data?.body;
								const data = remoteMessage?.data ?? {};
								const item = await notificationHistoryService.addNotification({ title, body, data });
								emitSaved(item);
							} catch {
								// ignore
							}
						});
					} catch {
						// ignore background registration issues
					}
				}

				// user tapped notification (when app in background)
				if (typeof messaging.onNotificationOpenedApp === 'function') {
					fcmOnNotificationOpenedUnsub = messaging.onNotificationOpenedApp(async (remoteMessage: any) => {
						try {
							const content = remoteMessage?.notification ?? {};
							const title = content?.title ?? remoteMessage?.data?.title;
							const body = content?.body ?? remoteMessage?.data?.body;
							const data = remoteMessage?.data ?? {};
							const item = await notificationHistoryService.addNotification({ title, body, data });
							emitSaved(item);
						} catch {
							// ignore
						}
					});
				}

				// app opened from quit state via notification
				if (typeof messaging.getInitialNotification === 'function') {
					try {
						const initial = await messaging.getInitialNotification();
						if (initial) {
							const content = initial?.notification ?? {};
							const title = content?.title ?? initial?.data?.title;
							const body = content?.body ?? initial?.data?.body;
							const data = initial?.data ?? {};
							await notificationHistoryService.addNotification({ title, body, data });
						}
					} catch {
						// ignore
					}
				}
			}
		} catch {
			// react-native-firebase/messaging not available - ignore
		}

		_listenersRegistered = true;
		return () => {
			if (receivedSub && typeof receivedSub.remove === 'function') receivedSub.remove();
			if (responseSub && typeof responseSub.remove === 'function') responseSub.remove();
			// cleanup firebase unsubscribes if present
			try { if (fcmOnMessageUnsub) fcmOnMessageUnsub(); } catch {}
			try { if (fcmOnNotificationOpenedUnsub) fcmOnNotificationOpenedUnsub(); } catch {}
			_listenersRegistered = false;
		};
	} catch {
		// expo-notifications not available
		return () => {};
	}
};

export const sendNotificationToAndroid = async (payload: {
  title?: string;
  body?: string;
  data?: Record<string, any>;
  device_tokens?: string[]; // optional: target specific tokens
}) => {
  try {
    // Backend should accept device_type to filter recipients; adjust endpoint/body per your API
    const body = {
      title: payload.title,
      body: payload.body,
      data: payload.data,
      device_type: 'android',
      device_tokens: payload.device_tokens, // undefined = broadcast to android devices
    };
    const response = await apiClient.post('/notifications/send', body);
    return response.data;
  } catch (err) {
    throw err;
  }
};

export const sendNotificationToDeviceOnAndroid = async (deviceToken: string, payload: {
  title?: string;
  body?: string;
  data?: Record<string, any>;
}) => {
  try {
    const response = await sendNotificationToAndroid({
      title: payload.title,
      body: payload.body,
      data: payload.data,
      device_tokens: [deviceToken],
    });
    return response;
  } catch (err) {
    throw err;
  }
};
