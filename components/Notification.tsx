import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { initNotificationListeners, registerFcmTokenAndStore } from '../services/notificationService';

export default function NotificationHandler(): null {
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    (async () => {
      try {
        // initialize listeners (expo + firebase handlers). Returns a cleanup fn.
        cleanup = await initNotificationListeners();
      } catch {
        // ignore init errors
      }

      try {
        // register native FCM token with backend (no-op for Expo tokens)
        await registerFcmTokenAndStore();
      } catch {
        // ignore token registration errors
      }

      // optional: ensure Android channel & permissions are set — initNotificationListeners already attempts this,
      // but we avoid duplicating heavy imports here.
    })();

    return () => {
      try { if (cleanup) cleanup(); } catch { /* ignore */ }
    };
  }, []);

  return null;
}
