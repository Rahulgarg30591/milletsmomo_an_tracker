import { useCallback, useEffect, useState } from 'react';
import { getPushPublicKey, savePushSubscription, deletePushSubscription } from '../api/pushApi';

export type PushState = 'unsupported' | 'denied' | 'off' | 'on' | 'busy';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** Turns this device's admin notifications on or off via Web Push. */
export function usePushNotifications() {
  const [state, setState] = useState<PushState>(isSupported() ? 'busy' : 'unsupported');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupported()) return;
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }
    let cancelled = false;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (cancelled) return;
        setState(sub ? 'on' : 'off');
        // Re-send so the server still has it after a database reset.
        if (sub) savePushSubscription(sub.toJSON()).catch(() => {});
      })
      .catch(() => !cancelled && setState('off'));
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    setError(null);
    setState('busy');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const key = await getPushPublicKey();
      if (!key) {
        setError('Notifications are not set up on the server yet.');
        setState('off');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });
      await savePushSubscription(sub.toJSON());
      setState('on');
    } catch {
      setError('Could not turn on notifications.');
      setState('off');
    }
  }, []);

  const disable = useCallback(async () => {
    setError(null);
    setState('busy');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint).catch(() => {});
        await sub.unsubscribe();
      }
      setState('off');
    } catch {
      setError('Could not turn off notifications.');
      setState('on');
    }
  }, []);

  return { state, error, enable, disable };
}
