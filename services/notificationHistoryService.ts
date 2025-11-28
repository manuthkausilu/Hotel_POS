import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NotificationHistory } from '../types/Notification';

const STORAGE_KEY = '@notification_history';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const EXPIRY_DAYS = 7;

const nowIso = () => new Date().toISOString();

const tryParse = (v: any) => {
  try {
    return typeof v === 'string' ? JSON.parse(v) : v;
  } catch {
    return null;
  }
};

const first = (...vals: any[]) => {
  for (const v of vals) if (v !== null && v !== undefined) return v;
  return undefined;
};

// Normalize any incoming payload/record so title/body/data are extracted from common shapes
const normalizePayload = (raw: any) => {
  if (!raw) return { title: undefined, body: undefined, data: undefined };

  const maybeData = tryParse(raw.data) ?? raw.data ?? tryParse(raw?.message?.data) ?? raw?.message?.data;
  const maybeMessage = raw.message ?? tryParse(raw.message);
  const maybeNotification =
    raw.notification ??
    maybeMessage?.notification ??
    tryParse(raw.notification) ??
    tryParse(maybeMessage?.notification);

  const title = first(
    raw.title,
    maybeNotification?.title,
    raw.notification?.title,
    maybeMessage?.notification?.title,
    maybeData?.title,
    maybeData?.notification?.title
  );

  const body = first(
    raw.body,
    maybeNotification?.body,
    raw.notification?.body,
    maybeMessage?.notification?.body,
    maybeData?.body
  );

  // choose a compact object for data if present
  const data = typeof maybeData === 'object' ? maybeData : (maybeData ? { value: maybeData } : undefined);

  return { title, body, data };
};

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
  addNotification: async (payload: { title?: string; body?: string; data?: Record<string, any> } | any) => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const list = parse(raw);
    const created_at = nowIso();
    const expires_at = new Date(Date.now() + EXPIRY_DAYS * MS_PER_DAY).toISOString();

    // normalize payload so stored item always has title/body/data when available
    const normalized = normalizePayload(payload);

    const item: NotificationHistory = {
      id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      title: normalized.title,
      body: normalized.body,
      data: normalized.data ?? (payload?.data && typeof payload.data === 'object' ? payload.data : undefined),
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

    // ensure legacy/unnormalized items are normalized on read
    list = list.map((i) => {
      // if item already has title/body it's fine, but normalize to ensure data shape consistency
      const normalized = normalizePayload(i);
      return { ...i, title: normalized.title ?? i.title, body: normalized.body ?? i.body, data: normalized.data ?? i.data };
    });

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
