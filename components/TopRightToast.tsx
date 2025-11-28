import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { onNotificationSaved } from '../services/notificationService';
import { JSX } from 'react/jsx-runtime';

type ToastItem = { title?: string; body?: string; id?: string } | null;

export default function TopRightToast(): JSX.Element | null {
  const [toast, setToast] = useState<ToastItem>(null);
  const [focused, setFocused] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(40)).current;
  const scale = useRef(new Animated.Value(0.97)).current;
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
      // animate opacity, translate and a small focus-scale pulse
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.02, duration: 160, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.0, duration: 120, useNativeDriver: true }),
        ]),
      ]).start();

      // set temporary focused visual state
      setFocused(true);
      const focusTimer = setTimeout(() => setFocused(false), 1200);
      // clear the focus timer when hiding
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      // ensure focus timer cleared on unmount as well
      const clearFocus = () => clearTimeout(focusTimer);
      // attach cleanup to unsub later by returning clearFocus in effect return (handled below)
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
      Animated.timing(scale, { toValue: 0.97, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setToast(null);
      setFocused(false);
    });
  };

  if (!toast) return null;

  return (
    <View pointerEvents="box-none" style={styles.container}>
      <Animated.View
        style={[
          styles.toast,
          focused ? styles.toastFocused : null,
          {
            opacity,
            transform: [{ translateX }, { scale }],
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
    backgroundColor: '#FFFFFF',            // white card
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 6,
    borderLeftColor: '#FF6B6B',            // app accent
    shadowColor: '#FF6B6B',                // subtle red shadow tint
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 8,
  },
  // focused variant (applies briefly when toast shows)
  toastFocused: {
    backgroundColor: '#FFF5F5', // light red tint
    shadowOpacity: 0.22,
    shadowRadius: 14,
    borderLeftColor: '#FF6B6B',
  },
  textWrap: { flex: 1, paddingRight: 8 },
  title: { color: '#111827', fontWeight: '700', fontSize: 14, marginBottom: 2 }, // dark title
  body: { color: '#6b7280', fontSize: 12 },                                      // muted body
  closeBtn: { padding: 6 },
  closeText: { color: '#FF6B6B', fontSize: 18, lineHeight: 18 },                 // red close
});
