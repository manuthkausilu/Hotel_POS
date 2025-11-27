import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NotificationHistory } from '../types/Notification';

const STORAGE_KEY = '@notification_history';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const EXPIRY_DAYS = 7;

const nowIso = () => new Date().toISOString();

const parse = (raw: string | null): NotificationHistory[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as NotificationHistory[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const persist = async (list: NotificationHistory[]) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
};

export const notificationHistoryService = {
  addNotification: async (payload: { title?: string; body?: string; data?: Record<string, any> }) => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const list = parse(raw);
    const created_at = nowIso();
    const expires_at = new Date(Date.now() + EXPIRY_DAYS * MS_PER_DAY).toISOString();
    const item: NotificationHistory = {
      id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      created_at,
      expires_at,
      is_read: false,
    };
    // newest first
    list.unshift(item);
    await persist(list);
    return item;
  },

  getNotifications: async (): Promise<NotificationHistory[]> => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    let list = parse(raw);
    const now = Date.now();
    const filtered = list.filter(i => new Date(i.expires_at).getTime() > now);
    if (filtered.length !== list.length) {
      // prune expired
      await persist(filtered);
    }
    // sort newest first
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return filtered;
  },

  deleteNotification: async (id: string) => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const list = parse(raw);
    const next = list.filter(i => i.id !== id);
    await persist(next);
    return next;
  },

  markAsRead: async (id: string) => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const list = parse(raw);
    const next = list.map(i => (i.id === id ? { ...i, is_read: true } : i));
    await persist(next);
    return next;
  },

  cleanupExpiredNotifications: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const list = parse(raw);
    const now = Date.now();
    const filtered = list.filter(i => new Date(i.expires_at).getTime() > now);
    if (filtered.length !== list.length) {
      await persist(filtered);
    }
    return filtered;
  },

  // convenience: clear all history (not used by default)
  clearAll: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
  },
};
