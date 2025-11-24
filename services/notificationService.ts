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
