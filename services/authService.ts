import AsyncStorage from '@react-native-async-storage/async-storage';
import { LoginRequest, LoginResponse } from '../types/Auth';
import { User } from '../types/User';
import { apiClient, TOKEN_KEY } from './apiClient';
import { registerFcmTokenAndStore, destroyDeviceToken } from './notificationService';

export const authService = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    // remove any previously stored token so the login request does not ship a stale Authorization header
    await AsyncStorage.removeItem(TOKEN_KEY);
    const payload: LoginRequest = {
      email,
      password,
      device_name: 'android-mobile',
    };

    const response = await apiClient.post<LoginResponse>('/login', payload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
    
    console.log('📥 Full Login response:', response.data);
    
    if (response.data.token) {
      await AsyncStorage.setItem(TOKEN_KEY, response.data.token);
      console.log('✅ Token saved:', response.data.token);
      console.log('✅ Token type:', response.data.token_type);

      // register FCM token with backend after successful login
      try {
        // ensure backend receives app_type = 'pos_system'
        const fcmToken = await registerFcmTokenAndStore('pos_system');
        console.log('FCM registration result token:', fcmToken);
      } catch (err) {
        console.warn('Failed to register FCM token after login:', err);
      }
    }

    if (response.data.user) {
      await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
      console.log('✅ User saved:', response.data.user);
    }

    return response.data;
  },

  logout: async (): Promise<void> => {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    console.log('🔴 Logging out with token:', token);
    
    // attempt to remove device token from backend first (best-effort)
    try {
      await destroyDeviceToken();
      console.log('✅ Device token removed from backend');
    } catch (err) {
      console.warn('Failed to remove device token from backend during logout:', err);
    }

    try {
      await apiClient.post('/logout');
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem('user');
      console.log('🗑️ Token and user removed');
    }
  },

  getToken: async (): Promise<string | null> => {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    console.log('🔍 Getting token:', token);
    return token;
  },

  isAuthenticated: async (): Promise<boolean> => {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    console.log('🔐 Checking authentication, token:', token);
    return !!token;
  },

  getCurrentUser: async (): Promise<User | null> => {
    try {
      const response = await apiClient.get<User>('/me');
      console.log('📥 /me response:', response.data);
      if (response.data) {
        await AsyncStorage.setItem('user', JSON.stringify(response.data));
        console.log('✅ Current user saved');
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Error fetching /me:', error);
      return null;
    }
  },
};
