import { onHttpError } from '@/services/http';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated as RNAnimated, StyleSheet, Text } from 'react-native';

type ToastListener = (message: string) => void;
const toastListeners = new Set<ToastListener>();

export function showToast(message: string) {
  const msg = String(message || '').trim();
  if (!msg) return;
  toastListeners.forEach((l) => l(msg));
}

export default function Toast() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState<string>('');
  const opacity = useMemo(() => new RNAnimated.Value(0), []);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useMemo(() => {
    return (msg: string) => {
      const m = String(msg || '').trim();
      if (!m) return;
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setMessage(m);
      setVisible(true);
      opacity.stopAnimation();
      opacity.setValue(0);
      RNAnimated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start(() => {
        hideTimerRef.current = setTimeout(() => {
          RNAnimated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setVisible(false));
        }, 2500);
      });
    };
  }, [opacity]);

  useEffect(() => {
    const unsubscribeHttp = onHttpError((err) => {
      // Skip 404 errors - don't show toast
      if ((err as any)?.status === 404) return;
      const msg = (err as any)?.message || 'Network error';
      show(String(msg));
    });

    const toastListener: ToastListener = (msg) => show(msg);
    toastListeners.add(toastListener);

    return () => {
      unsubscribeHttp();
      toastListeners.delete(toastListener);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [show]);

  if (!visible) return null;
  return (
    <RNAnimated.View style={[styles.container, { opacity }] }>
      <Text style={styles.text} numberOfLines={2}>{message}</Text>
    </RNAnimated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  text: {
    color: '#fff',
    fontSize: 14,
  },
});
