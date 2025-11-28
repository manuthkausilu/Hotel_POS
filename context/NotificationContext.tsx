import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { notificationHistoryService, normalizePayload } from '../services/notificationHistoryService';
import { initNotificationListeners, onNotificationSaved, offNotificationSaved } from '../services/notificationService';
import type { NotificationHistory } from '../types/Notification';

type NotificationContextValue = {
  notifications: NotificationHistory[];
  refresh: () => Promise<void>;
  addNotification: (payload: { title?: string; body?: string; data?: Record<string, any> }) => Promise<NotificationHistory>;
  deleteNotification: (id: string) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationHistory[]>([]);

  const clearAll = async () => {
    try {
      await notificationHistoryService.clearAll();
      setNotifications([]);
    } catch {
      // ignore
    }
  };

  const refresh = async () => {
    const list = await notificationHistoryService.getNotifications();
    // ensure each item is normalized for title/body/data before exposing to consumers
    const normalized = list.map(i => {
      const n = normalizePayload(i);
      return { ...i, title: i.title ?? n.title ?? 'No title', body: i.body ?? n.body ?? '', data: i.data ?? n.data };
    });
    setNotifications(normalized);
  };

  const addNotification = async (payload: { title?: string; body?: string; data?: Record<string, any> }) => {
    try {
      const item = await notificationHistoryService.addNotification(payload);
      const n = normalizePayload(item);
      setNotifications(prev => {
        if (prev.some(p => p.id === item.id)) return prev;
        return [{ ...item, title: item.title ?? n.title ?? 'No title', body: item.body ?? n.body ?? '', data: item.data ?? n.data }, ...prev];
      });
      Alert.alert('Notification saved', item.title ?? 'Notification saved to history.');
      return item;
    } catch (err) {
      Alert.alert('Notification not saved', 'Failed to save notification.');
      throw err;
    }
  };

  const deleteNotification = async (id: string) => {
    await notificationHistoryService.deleteNotification(id);
    setNotifications(prev => prev.filter(i => i.id !== id));
  };

  const markAsRead = async (id: string) => {
    await notificationHistoryService.markAsRead(id);
    setNotifications(prev => prev.map(i => (i.id === id ? { ...i, is_read: true } : i)));
  };

  useEffect(() => {
    let mounted = true;
    let cleanupListeners: (() => void) | null = null;

    const handleSaved = (item: NotificationHistory) => {
      if (!mounted) return;
      // prepend new item if not already present
      const n = normalizePayload(item);
      setNotifications(prev => {
        if (prev.some(p => p.id === item.id)) return prev;
        return [{ ...item, title: item.title ?? n.title ?? 'No title', body: item.body ?? n.body ?? '', data: item.data ?? n.data }, ...prev];
      });
    };

    const init = async () => {
      // register centralized listeners first so incoming notifications are saved immediately
      try {
        cleanupListeners = await initNotificationListeners();
      } catch {
        cleanupListeners = null;
      }

      // subscribe to saved-notification events from service immediately
      onNotificationSaved(handleSaved);

      await notificationHistoryService.cleanupExpiredNotifications();
      const list = await notificationHistoryService.getNotifications();

      if (mounted) {
        // normalize initial list before exposing
        const normalized = list.map(i => {
          const n = normalizePayload(i);
          return { ...i, title: i.title ?? n.title ?? 'No title', body: i.body ?? n.body ?? '', data: i.data ?? n.data };
        });
        setNotifications(normalized);
      }
    };
    init();

    // periodic cleanup every hour
    const interval = setInterval(() => {
      notificationHistoryService.cleanupExpiredNotifications().then(refresh).catch(() => {});
    }, 60 * 60 * 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
      if (cleanupListeners) cleanupListeners();
      offNotificationSaved(handleSaved);
    };
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, refresh, addNotification, deleteNotification, markAsRead, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};
