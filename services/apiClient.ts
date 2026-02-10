import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// const API_BASE_URL = 'https://demo.trackerstay.com/api';
const API_BASE_URL = (process.env.API_BASE_URL as string) ?? 'https://demo.trackerstay.com/api';
const TOKEN_KEY = '@auth_token';

// Global handler for 401 errors - can be set from AuthContext
let onUnauthenticatedHandler: (() => void) | null = null;
// Flag to prevent infinite loops during logout
let isLoggingOut = false;

export const setUnauthenticatedHandler = (handler: (() => void) | null) => {
  onUnauthenticatedHandler = handler;
};

export const setLoggingOut = function (value: boolean) {
  isLoggingOut = value;
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
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    
    console.log('📤 API Request:', config.method?.toUpperCase(), config.url);
    console.log('🔑 Token in request:', token ? token.substring(0, 20) + '...' : 'No token');
    
    // Ensure headers are always set
    config.headers['Content-Type'] = 'application/json';
    config.headers['Accept'] = 'application/json';
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Unauthenticated';
      
      // Remove token from storage
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem('user');
      
      console.log('🔴 401 Unauthorized - Token removed. Error:', errorMessage);
      
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
      
      // Create a more descriptive error
      const authError = new Error(errorMessage);
      (authError as any).isUnauthenticated = true;
      (authError as any).status = 401;
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

