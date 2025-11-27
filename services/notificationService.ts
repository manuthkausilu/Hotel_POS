import { Platform } from 'react-native';
import { apiClient } from './apiClient';
import { DeviceToken } from '../types/Notification';

export const storeDeviceToken = async (deviceToken: string) => {
  try {
    const response = await apiClient.post('/user/device-token', { 
      device_token: deviceToken,
      device_type: Platform.OS === 'ios' ? 'ios' : 'android'
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const destroyDeviceToken = async () => {
  try {
    const response = await apiClient.delete('/user/device-token');
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
    const messagingModule = await import('@react-native-firebase/messaging');
    const messaging = messagingModule.default ? messagingModule.default : messagingModule;
    const fcmToken = await messaging.getToken();
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
export const registerFcmTokenAndStore = async (): Promise<string | null> => {
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
    await storeDeviceToken(token);
    console.log('Device token registered with backend:', token);
    return token;
  } catch (err) {
    console.warn('Failed to store device token on backend:', err);
    return null;
  }
};
