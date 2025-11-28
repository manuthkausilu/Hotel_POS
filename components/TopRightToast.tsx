import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { onNotificationSaved } from '../services/notificationService';
import { JSX } from 'react/jsx-runtime';

type ToastItem = { title?: string; body?: string; id?: string } | null;

export default function TopRightToast(): JSX.Element | null {
  const [toast, setToast] = useState<ToastItem>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(40)).current;
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    const unsub = onNotificationSaved((item: any) => {
      // item may be null or metadata-only; ensure we have something meaningful
      if (!item) return;
      const title = item.title ?? item?.data?.title ?? 'Notification';
      const body = item.body ?? item?.data?.body ?? '';
      const id = item.id ?? String(Date.now());
      // show toast
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      setToast({ title, body, id });
      // animate in
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
      // auto hide after 3s
      hideTimer.current = (setTimeout(() => hide(), 3000) as unknown) as number;
    });

    return () => {
      unsub();
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    };
  }, [opacity, translateX]);

  const hide = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 40, duration: 180, useNativeDriver: true }),
    ]).start(() => setToast(null));
  };

  if (!toast) return null;

  return (
    <View pointerEvents="box-none" style={styles.container}>
      <Animated.View
        style={[
          styles.toast,
          {
            opacity,
            transform: [{ translateX }],
          },
        ]}
      >
        <View style={styles.textWrap}>
          <Text numberOfLines={1} style={styles.title}>{toast.title}</Text>
          {toast.body ? <Text numberOfLines={2} style={styles.body}>{toast.body}</Text> : null}
        </View>
        <TouchableOpacity onPress={hide} style={styles.closeBtn}>
          <Text style={styles.closeText}>×</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 44,
    right: 12,
    zIndex: 9999,
    elevation: 9999,
    pointerEvents: 'box-none',
  },
  toast: {
    minWidth: 220,
    maxWidth: 320,
    backgroundColor: '#111827',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },
  textWrap: { flex: 1, paddingRight: 8 },
  title: { color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 2 },
  body: { color: '#e5e7eb', fontSize: 12 },
  closeBtn: { padding: 6 },
  closeText: { color: '#fff', fontSize: 16, lineHeight: 16 },
});
