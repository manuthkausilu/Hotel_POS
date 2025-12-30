import { apiClient } from './apiClient';

export interface HotelSettings {
  service_charge: string;
  service_charge_enabled: number;
  currency: string;
  timezone: string;
}

export interface HotelSettingsResponse {
  success: boolean;
  settings: HotelSettings;
}

export const getHotelSettings = async (): Promise<HotelSettings> => {
  try {
    const response = await apiClient.get<HotelSettingsResponse>('/pos/hotel_settings');
    return response.data.settings;
  } catch (error) {
    console.error('Error fetching hotel settings:', error);
    throw error;
  }
};
