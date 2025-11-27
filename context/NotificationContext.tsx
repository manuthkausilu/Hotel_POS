import React, { createContext, useContext, useEffect, useState } from 'react';
import { notificationHistoryService } from '../services/notificationHistoryService';
import type { NotificationHistory } from '../types/Notification';

type NotificationContextValue = {
  notifications: NotificationHistory[];
  refresh: () => Promise<void>;
  addNotification: (payload: { title?: string; body?: string; data?: Record<string, any> }) => Promise<NotificationHistory>;
  deleteNotification: (id: string) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationHistory[]>([]);

  const refresh = async () => {
    const list = await notificationHistoryService.getNotifications();
    setNotifications(list);
  };

  const addNotification = async (payload: { title?: string; body?: string; data?: Record<string, any> }) => {
    const item = await notificationHistoryService.addNotification(payload);
    setNotifications(prev => [item, ...prev]);
    return item;
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
    let receivedSub: { remove: () => void } | null = null;
    let responseSub: { remove: () => void } | null = null;

    const init = async () => {
      await notificationHistoryService.cleanupExpiredNotifications();
      const list = await notificationHistoryService.getNotifications();
      if (mounted) setNotifications(list);

      // register listeners (dynamic import to avoid crash if not installed)
      try {
        const Notifications: any = await import('expo-notifications');

        // when a notification is received while app in foreground/background
        receivedSub = Notifications?.addNotificationReceivedListener?.((notif: any) => {
          try {
            const content = notif?.request?.content ?? {};
            const title = content.title ?? undefined;
            const body = content.body ?? undefined;
            const data = content.data ?? undefined;
            // persist to history via context addNotification
            addNotification({ title, body, data }).catch(() => {});
          } catch {
            // ignore
          }
        });

        // when user interacts with a notification (taps)
        responseSub = Notifications?.addNotificationResponseReceivedListener?.((response: any) => {
          try {
            const content = response?.notification?.request?.content ?? {};
            const title = content.title ?? undefined;
            const body = content.body ?? undefined;
            const data = content.data ?? undefined;
            addNotification({ title, body, data }).catch(() => {});
          } catch {
            // ignore
          }
        });
      } catch {
        // expo-notifications not available — skip listeners
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
      if (receivedSub && typeof receivedSub.remove === 'function') receivedSub.remove();
      if (responseSub && typeof responseSub.remove === 'function') responseSub.remove();
    };
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, refresh, addNotification, deleteNotification, markAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};
