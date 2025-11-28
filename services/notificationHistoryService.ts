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
export const normalizePayload = (raw: any) => {
  if (!raw) return { title: undefined, body: undefined, data: undefined };

  const maybeData = tryParse(raw.data) ?? raw.data ?? tryParse(raw?.message?.data) ?? raw?.message?.data;
  const maybeMessage = raw.message ?? tryParse(raw.message);
  const maybeNotification =
    raw.notification ??
    maybeMessage?.notification ??
    tryParse(raw.notification) ??
    tryParse(maybeMessage?.notification);

  // helper: recursively search object (and stringified JSON) for keys that look like title/body
  const findFieldInObject = (obj: any, nameTokens: string[]): string | undefined => {
    if (!obj) return undefined;
    if (typeof obj === 'string') {
      // try parse string as JSON and search inside
      const parsed = tryParse(obj);
      if (parsed) return findFieldInObject(parsed, nameTokens);
      // otherwise no structured data here
      return undefined;
    }
    if (typeof obj !== 'object') return undefined;

    // first pass: keys that contain the tokens
    for (const k of Object.keys(obj)) {
      const val = obj[k];
      const lk = String(k).toLowerCase();
      for (const token of nameTokens) {
        if (lk.includes(token)) {
          if (typeof val === 'string' && val.trim()) return val;
          if (typeof val === 'object') {
            const nested = findFieldInObject(val, nameTokens);
            if (nested) return nested;
          } else if (typeof val === 'number' || typeof val === 'boolean') {
            // convert non-string primitive to string fallback
            return String(val);
          }
        }
      }
    }

    // second pass: search nested objects / stringified JSON
    for (const k of Object.keys(obj)) {
      const val = obj[k];
      if (typeof val === 'object') {
        const nested = findFieldInObject(val, nameTokens);
        if (nested) return nested;
      } else if (typeof val === 'string') {
        const parsed = tryParse(val);
        if (parsed) {
          const nested = findFieldInObject(parsed, nameTokens);
          if (nested) return nested;
        }
      }
    }

    return undefined;
  };

  // helper: pick first non-empty string anywhere in object as last-resort fallback
  const findAnyString = (obj: any): string | undefined => {
    if (!obj) return undefined;
    if (typeof obj === 'string') {
      const s = obj.trim();
      if (s) return s;
      return undefined;
    }
    if (typeof obj !== 'object') return undefined;
    for (const k of Object.keys(obj)) {
      const val = obj[k];
      if (typeof val === 'string' && val.trim()) return val;
      if (typeof val === 'object') {
        const nested = findAnyString(val);
        if (nested) return nested;
      } else if (typeof val === 'number' || typeof val === 'boolean') {
        return String(val);
      }
    }
    return undefined;
  };

  // common search tokens
  const titleTokens = ['title', 'gcm.notification.title', 'notification.title', 'message.notification.title', 'alert', 'subject'];
  const bodyTokens = ['body', 'message', 'alert', 'gcm.notification.body', 'notification.body', 'message.notification.body', 'text'];

  const titleCandidate = first(
    raw.title,
    maybeNotification?.title,
    raw.notification?.title,
    maybeMessage?.notification?.title,
    maybeData?.title,
    maybeData?.notification?.title,
    // search nested/stringified payload keys
    findFieldInObject(maybeData, titleTokens),
    findFieldInObject(raw, titleTokens)
  );

  const bodyCandidate = first(
    raw.body,
    maybeNotification?.body,
    raw.notification?.body,
    maybeMessage?.notification?.body,
    maybeData?.body,
    // search nested/stringified payload keys
    findFieldInObject(maybeData, bodyTokens),
    findFieldInObject(raw, bodyTokens)
  );

  // last-resort: any non-empty string in data or raw
  const fallbackTitle = titleCandidate ?? findAnyString(maybeData) ?? findAnyString(raw);
  const fallbackBody = bodyCandidate ?? findAnyString(maybeData) ?? findAnyString(raw);

  const title = typeof titleCandidate === 'string' && titleCandidate.trim() ? titleCandidate : (typeof fallbackTitle === 'string' && fallbackTitle.trim() ? fallbackTitle : undefined);
  const body = typeof bodyCandidate === 'string' && bodyCandidate.trim() ? bodyCandidate : (typeof fallbackBody === 'string' && fallbackBody.trim() ? fallbackBody : undefined);

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
