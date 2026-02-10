import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// const API_BASE_URL = 'https://demo.trackerstay.com/api';
const API_BASE_URL = (process.env.API_BASE_URL as string) ?? 'https://demo.trackerstay.com/api';
const TOKEN_KEY = '@auth_token';

// Global handler for 401 errors - can be set from AuthContext
let onUnauthenticatedHandler: (() => void) | null = null;

export const setUnauthenticatedHandler = (handler: (() => void) | null) => {
  onUnauthenticatedHandler = handler;
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
      
      // Trigger logout handler if set (from AuthContext)
      if (onUnauthenticatedHandler) {
        try {
          onUnauthenticatedHandler();
        } catch (err) {
          console.error('Error in unauthenticated handler:', err);
        }
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

