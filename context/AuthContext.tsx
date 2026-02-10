import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { TOKEN_KEY, setUnauthenticatedHandler, setCachedToken, setCachedUserId } from '../services/apiClient';
import { authService } from '../services/authService';
import { User } from '../types/Auth';
import { storeDeviceToken, registerFcmTokenAndStore } from '../services/notificationService';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  deviceToken: string | null;
  setDeviceToken: (token: string) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const logoutRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    checkAuth();

    // Set up global handler for 401 errors from API client
    const handleUnauthenticated = async () => {
      console.log('🔴 Unauthenticated error detected - triggering logout');
      if (logoutRef.current) {
        await logoutRef.current();
      }
    };

    setUnauthenticatedHandler(handleUnauthenticated);

    return () => {
      setUnauthenticatedHandler(null);
    };
  }, []);

  const checkAuth = async () => {
    try {
      const authenticated = await authService.isAuthenticated();
      setIsAuthenticated(authenticated);

      if (authenticated) {
        const userStr = await AsyncStorage.getItem('user');
        if (userStr) {
          const userData = JSON.parse(userStr);
          setUser(userData);
          // Also set in-memory cache for API client
          const token = await AsyncStorage.getItem(TOKEN_KEY);
          setCachedToken(token);
          setCachedUserId(userData?.user_id || userData?.id);
          console.log('👤 User loaded from storage:', userData);
        }
      } else {
        // Clear user if not authenticated
        setUser(null);
        setCachedToken(null);
        setCachedUserId(null);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await authService.login(email, password);

    // Update in-memory cache immediately to prevent race conditions
    if (response.token) {
      setCachedToken(response.token);
    }
    if (response.user) {
      setCachedUserId(response.user.user_id || response.user.id);
    }

    setIsAuthenticated(true);
    setUser(response.user ?? null);

    // Only handle the Expo fallback here as registerFcmTokenAndStore is now in authService
    if (deviceToken) {
      try {
        await storeDeviceToken(deviceToken);
        console.log('✅ Fallback Expo token stored');
      } catch (fbError) {
        console.error('❌ Fallback token storage failed:', fbError);
      }
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.log('Logout error:', error);
    } finally {
      setCachedToken(null);
      setCachedUserId(null);
      await AsyncStorage.multiRemove([TOKEN_KEY, 'user']);
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  // Store logout function in ref so it can be called from API interceptor
  logoutRef.current = logout;

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, isLoading, deviceToken, setDeviceToken, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

