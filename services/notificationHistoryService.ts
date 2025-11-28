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

// list of keys that are purely metadata and should be ignored when deciding title/body
const METADATA_KEY_PATTERNS = [/^google(\.|_)?/i, /^gcm(\.|_)?/i];
const METADATA_KEYS = new Set(['collapse_key', 'from', 'google.message_id', 'google.sent_time', 'google.ttl', 'google.product_id']);

// helper: detect likely package name strings (e.g. com.rayff60.hotel_pos)
const isLikelyPackageName = (s: any) => {
  if (typeof s !== 'string') return false;
  const trimmed = s.trim();
  // simple heuristic: contains at least one dot and no space, and limited length
  return /\./.test(trimmed) && !/\s/.test(trimmed) && trimmed.length < 120;
};

// Clean object by removing metadata-only keys (shallow)
const cleanDataObject = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  const out: any = Array.isArray(obj) ? [] : {};
  for (const k of Object.keys(obj)) {
    // skip metadata keys
    if (METADATA_KEYS.has(k)) continue;
    if (METADATA_KEY_PATTERNS.some(p => p.test(k))) continue;
    const v = obj[k];
    // if value looks like package name, skip
    if (typeof v === 'string' && isLikelyPackageName(v)) continue;
    // recursively clean nested objects
    if (typeof v === 'object' && v !== null) {
      const cleaned = cleanDataObject(v);
      // only include if cleaned has keys or non-empty values
      if (typeof cleaned === 'object' && Object.keys(cleaned).length === 0) continue;
      out[k] = cleaned;
    } else {
      out[k] = v;
    }
  }
  return out;
};

// Normalize any incoming payload/record so title/body/data are extracted from common shapes
export const normalizePayload = (raw: any) => {
  if (!raw) return { title: undefined, body: undefined, data: undefined };

  const maybeData = tryParse(raw.data) ?? raw.data ?? tryParse(raw?.message?.data) ?? raw?.message?.data;
  const cleanedMaybeData = cleanDataObject(maybeData);
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
      // skip strings that look like package names or are metadata-like
      if (isLikelyPackageName(obj)) return undefined;
      // no structured data here
      return undefined;
    }
    if (typeof obj !== 'object') return undefined;

    // first pass: keys that contain the tokens
    for (const k of Object.keys(obj)) {
      // skip metadata keys
      if (METADATA_KEYS.has(k) || METADATA_KEY_PATTERNS.some(p => p.test(k))) continue;
      const val = obj[k];
      const lk = String(k).toLowerCase();
      for (const token of nameTokens) {
        if (lk.includes(token)) {
          if (typeof val === 'string' && val.trim() && !isLikelyPackageName(val)) return val;
          if (typeof val === 'object') {
            const nested = findFieldInObject(val, nameTokens);
            if (nested) return nested;
          } else if (typeof val === 'number' || typeof val === 'boolean') {
            return String(val);
          }
        }
      }
    }

    // second pass: search nested objects / stringified JSON
    for (const k of Object.keys(obj)) {
      if (METADATA_KEYS.has(k) || METADATA_KEY_PATTERNS.some(p => p.test(k))) continue;
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

  // helper: pick first non-empty string anywhere in object as last-resort fallback (but skip package names & metadata)
  const findAnyString = (obj: any): string | undefined => {
    if (!obj) return undefined;
    if (typeof obj === 'string') {
      const s = obj.trim();
      if (s && !isLikelyPackageName(s)) return s;
      return undefined;
    }
    if (typeof obj !== 'object') return undefined;
    for (const k of Object.keys(obj)) {
      if (METADATA_KEYS.has(k) || METADATA_KEY_PATTERNS.some(p => p.test(k))) continue;
      const val = obj[k];
      if (typeof val === 'string' && val.trim() && !isLikelyPackageName(val)) return val;
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
    cleanedMaybeData?.title,
    cleanedMaybeData?.notification?.title,
    // search nested/stringified payload keys but using cleaned data
    findFieldInObject(cleanedMaybeData, titleTokens),
    findFieldInObject(raw, titleTokens)
  );

  const bodyCandidate = first(
    raw.body,
    maybeNotification?.body,
    raw.notification?.body,
    maybeMessage?.notification?.body,
    cleanedMaybeData?.body,
    findFieldInObject(cleanedMaybeData, bodyTokens),
    findFieldInObject(raw, bodyTokens)
  );

  const fallbackTitle = titleCandidate ?? findAnyString(cleanedMaybeData) ?? findAnyString(raw);
  const fallbackBody = bodyCandidate ?? findAnyString(cleanedMaybeData) ?? findAnyString(raw);

  const title = typeof titleCandidate === 'string' && titleCandidate.trim() ? titleCandidate : (typeof fallbackTitle === 'string' && fallbackTitle.trim() ? fallbackTitle : undefined);
  const body = typeof bodyCandidate === 'string' && bodyCandidate.trim() ? bodyCandidate : (typeof fallbackBody === 'string' && fallbackBody.trim() ? fallbackBody : undefined);

  // choose a compact object for data if present (cleaned)
  const data = (typeof cleanedMaybeData === 'object' && Object.keys(cleanedMaybeData || {}).length > 0) ? cleanedMaybeData : undefined;

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

// NEW: try to extract a stable message id from common places in the payload
const getPayloadMessageId = (payload: any): string | undefined => {
  if (!payload) return undefined;
  // common fields that carry a unique message id
  const candidates = [
    payload?.data?.['google.message_id'],
    payload?.data?.google?.message_id,
    payload?.data?.messageId,
    payload?.data?.message_id,
    payload?.messageId,
    payload?.message?.messageId,
    payload?.message?.message_id,
    payload?.message_id,
    payload?.google?.message_id,
    payload?.google_message_id,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
    if (typeof c === 'number') return String(c);
  }
  return undefined;
};

export const notificationHistoryService = {
  addNotification: async (payload: { title?: string; body?: string; data?: Record<string, any> } | any) => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const list = parse(raw);
    const created_at = nowIso();
    const expires_at = new Date(Date.now() + EXPIRY_DAYS * MS_PER_DAY).toISOString();

    // normalize payload so stored item always has title/body/data when available
    const normalized = normalizePayload(payload);

    // dedupe: try to get a stable message id from the incoming payload
    const incomingMessageId = getPayloadMessageId(payload) ?? getPayloadMessageId(normalized?.data);
    if (incomingMessageId) {
      // if an existing item already has this message id saved, skip saving
      const already = list.find(i => {
        const idInData = i?.data && (i.data['_message_id'] ?? i.data['google.message_id'] ?? i.data['messageId'] ?? i.data['message_id']);
        return idInData && String(idInData) === incomingMessageId;
      });
      if (already) return null;
    } else {
      // fallback dedupe: avoid duplicate saves with identical title+body within short window (10s)
      const title = normalized?.title ?? payload?.title;
      const body = normalized?.body ?? payload?.body;
      if (title || body) {
        const now = Date.now();
        const duplicate = list.find(i => {
          if ((i.title ?? '') === (title ?? '') && (i.body ?? '') === (body ?? '')) {
            try {
              const t = new Date(i.created_at).getTime();
              return Math.abs(now - t) < 10_000; // 10 seconds
            } catch {
              return false;
            }
          }
          return false;
        });
        if (duplicate) return null;
      }
    }

    // decide whether data contains any meaningful keys (not just metadata)
    const hasMeaningfulData = normalized.data && Object.keys(normalized.data).length > 0;
    const hasTitleOrBody = (typeof normalized.title === 'string' && normalized.title.trim()) || (typeof normalized.body === 'string' && normalized.body.trim());

    // if nothing meaningful to save (no title/body and no meaningful data), skip saving
    if (!hasTitleOrBody && !hasMeaningfulData) {
      return null;
    }

    // ensure message id is recorded in the saved data so future dedupe works
    const savedData = (normalized.data ?? (payload?.data && typeof payload.data === 'object' ? cleanDataObject(payload.data) : undefined)) as any;
    if (incomingMessageId) {
      if (!savedData || typeof savedData !== 'object') {
        // ensure object
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        (savedData as any) = {};
      }
      (savedData as any)['_message_id'] = incomingMessageId;
    }

    const item: NotificationHistory = {
      id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      title: normalized.title,
      body: normalized.body,
      data: savedData ?? undefined,
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
