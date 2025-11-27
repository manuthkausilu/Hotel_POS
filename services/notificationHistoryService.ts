import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationHistory } from '../types/Notification';

const NOTIFICATION_HISTORY_KEY = '@notification_history';
const EXPIRY_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const nowIso = () => new Date().toISOString();

const parseList = (raw: string | null): NotificationHistory[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as NotificationHistory[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveList = async (list: NotificationHistory[]) => {
  await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(list));
};

export const notificationHistoryService = {
  addNotification: async (payload: { title?: string; body?: string; data?: Record<string, any> }) => {
    const list = parseList(await AsyncStorage.getItem(NOTIFICATION_HISTORY_KEY));
    const createdAt = nowIso();
    const expiresAt = new Date(Date.now() + EXPIRY_DAYS * MS_PER_DAY).toISOString();
    const item: NotificationHistory = {
      id: `${Date.now()}`, // simple unique id
      title: payload.title,
      body: payload.body,
      data: payload.data,
      created_at: createdAt,
      expires_at: expiresAt,
      is_read: false,
    };
    list.unshift(item); // newest first
    await saveList(list);
    return item;
  },

  getNotifications: async (): Promise<NotificationHistory[]> => {
    const raw = await AsyncStorage.getItem(NOTIFICATION_HISTORY_KEY);
    let list = parseList(raw);
    const now = Date.now();
    const filtered = list.filter(item => {
      const exp = new Date(item.expires_at).getTime();
      return exp > now;
    });
    if (filtered.length !== list.length) {
      // prune expired
      await saveList(filtered);
    }
    // return sorted newest first
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return filtered;
  },

  deleteNotification: async (id: string) => {
    const list = parseList(await AsyncStorage.getItem(NOTIFICATION_HISTORY_KEY));
    const next = list.filter(i => i.id !== id);
    await saveList(next);
    return next;
  },

  markAsRead: async (id: string) => {
    const list = parseList(await AsyncStorage.getItem(NOTIFICATION_HISTORY_KEY));
    const next = list.map(i => (i.id === id ? { ...i, is_read: true } : i));
    await saveList(next);
    return next;
  },

  cleanupExpiredNotifications: async () => {
    const list = parseList(await AsyncStorage.getItem(NOTIFICATION_HISTORY_KEY));
    const now = Date.now();
    const filtered = list.filter(item => new Date(item.expires_at).getTime() > now);
    if (filtered.length !== list.length) {
      await saveList(filtered);
    }
    return filtered;
  },
};
