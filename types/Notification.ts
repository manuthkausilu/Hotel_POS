export interface DeviceToken {
  id: number;
  user_id: number;
  device_token: string;
  device_type: string;
  app_type: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface NotificationHistory {
  id: string; // unique id (e.g. timestamp or uuid)
  title?: string;
  body?: string;
  data?: Record<string, any>;
  created_at: string; // ISO string
  expires_at: string; // ISO string (created_at + 7 days)
  is_read: boolean;
}
