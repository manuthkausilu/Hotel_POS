import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// const API_BASE_URL = 'https://demo.trackerstay.com/api';
const API_BASE_URL = (process.env.API_BASE_URL as string) ?? 'https://demo.trackerstay.com/api';
const TOKEN_KEY = '@auth_token';

// Global handler for 401 errors - can be set from AuthContext
let onUnauthenticatedHandler: (() => void) | null = null;
// Flag to prevent infinite loops during logout
let isLoggingOut = false;

// In-memory cache for auth to prevent AsyncStorage race conditions
let cachedToken: string | null = null;
let cachedUserId: string | null = null;

export const setUnauthenticatedHandler = (handler: (() => void) | null) => {
  onUnauthenticatedHandler = handler;
};

export const setLoggingOut = function (value: boolean) {
  isLoggingOut = value;
};

/**
 * Update the in-memory token cache. Call this after login.
 */
export const setCachedToken = (token: string | null) => {
  cachedToken = token;
  console.log('Ⓜ️ In-memory token updated');
};

/**
 * Update the in-memory user ID cache for headers. Call this after login.
 */
export const setCachedUserId = (id: string | number | null) => {
  cachedUserId = id ? String(id) : null;
  console.log('Ⓜ️ In-memory UserID updated:', cachedUserId);
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor to add token and ensure headers
apiClient.interceptors.request.use(
  async (config) => {
    // Try memory first, then AsyncStorage
    let token = cachedToken;
    if (!token) {
      token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token) cachedToken = token; // sync back to memory
    }

    let userId = cachedUserId;
    if (!userId) {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          userId = user?.user_id || user?.id || null;
          if (userId) cachedUserId = String(userId);
        } catch { /* ignore */ }
      }
    }

    console.log('📤 API Request:', config.method?.toUpperCase(), config.url);
    console.log('🔑 Token in request:', token ? token.substring(0, 20) + '...' : 'No token');
    if (userId) console.log('👤 X-User-Id:', userId);

    // Ensure headers are always set
    config.headers['Content-Type'] = 'application/json';
    config.headers['Accept'] = 'application/json';

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (userId) {
      config.headers['X-User-Id'] = String(userId);
      config.headers['user-id'] = String(userId);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Handle 401 Unauthorized errors
    if (error.response?.status === 401) {
      // Create a more descriptive error before cleaning up
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Unauthenticated';
      const authError = new Error(errorMessage);
      (authError as any).isUnauthenticated = true;
      (authError as any).status = 401;

      // Don't auto-logout if we are intentional about some background requests failing
      // or if it's a login request itself (which shouldn't happen for 401 but just in case)
      if (error.config?.url?.includes('/login')) {
        return Promise.reject(authError);
      }

      // Remove token from storage and memory
      cachedToken = null;
      cachedUserId = null;
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem('user');

      console.log('🔴 401 Unauthorized detected at', error.config?.url);
      console.log('🔴 Token removed. Message:', errorMessage);

      // Only trigger logout handler if we're not already logging out
      // This prevents infinite loops when logout API calls fail with 401
      if (onUnauthenticatedHandler && !isLoggingOut) {
        try {
          onUnauthenticatedHandler();
        } catch (err) {
          console.error('Error in unauthenticated handler:', err);
        }
      } else if (isLoggingOut) {
        console.log('⚠️ 401 during logout - skipping handler to prevent loop');
      }

      return Promise.reject(authError);
    }

    return Promise.reject(error);
  }
);

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

export { apiClient, TOKEN_KEY };

