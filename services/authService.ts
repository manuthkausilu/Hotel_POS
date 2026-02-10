import AsyncStorage from '@react-native-async-storage/async-storage';
import { LoginRequest, LoginResponse } from '../types/Auth';
import { User } from '../types/User';
import { apiClient, TOKEN_KEY, setLoggingOut, setCachedToken, setCachedUserId } from './apiClient';
import { registerFcmTokenAndStore, destroyDeviceToken } from './notificationService';

export const authService = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    // remove any previously stored token so the login request does not ship a stale Authorization header
    await AsyncStorage.removeItem(TOKEN_KEY);
    setCachedToken(null);
    setCachedUserId(null);

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
      const token = response.data.token;
      await AsyncStorage.setItem(TOKEN_KEY, token);

      // Update in-memory cache IMMEDIATELY so subsequent calls (like FCM) are authorized
      setCachedToken(token);
      if (response.data.user) {
        setCachedUserId(response.data.user.user_id || response.data.user.id);
      }

      console.log('✅ Token saved:', token);
      console.log('✅ Token type:', response.data.token_type);

      // Save user BEFORE FCM registration attempt
      if (response.data.user) {
        await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
        console.log('✅ User saved:', response.data.user);
      }

      // Register FCM token with backend AFTER successful login
      // Wrap in try-catch so login doesn't fail if FCM registration fails
      try {
        console.log('🔄 Registering FCM token (authService)...');
        // ensure backend receives app_type = 'pos_system'
        const fcmToken = await registerFcmTokenAndStore('pos_system');
        console.log('✅ FCM registration result token:', fcmToken);
      } catch (err) {
        // Don't fail login if FCM registration fails - this is non-critical
        console.warn('⚠️ Failed to register FCM token after login (non-critical):', err);
        // Continue anyway - user is still logged in
      }
    }

    return response.data;
  },

  logout: async (): Promise<void> => {
    // Set flag to prevent 401 handler from triggering during logout
    setLoggingOut(true);

    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      console.log('🔴 Logging out with token:', token);

      // attempt to remove device token from backend first (best-effort)
      // If this fails with 401, it won't trigger the logout handler again
      try {
        await destroyDeviceToken();
        console.log('✅ Device token removed from backend');
      } catch (err) {
        console.warn('Failed to remove device token from backend during logout:', err);
      }

      // Attempt logout API call (best-effort)
      // If this fails with 401, it won't trigger the logout handler again
      try {
        await apiClient.post('/logout');
        console.log('✅ Logout API call successful');
      } catch (error) {
        console.warn('Logout API error (non-critical):', error);
      }
    } finally {
      // Always clean up local storage and reset flag
      setCachedToken(null);
      setCachedUserId(null);
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem('user');
      console.log('🗑️ Token and user removed');
      setLoggingOut(false);
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