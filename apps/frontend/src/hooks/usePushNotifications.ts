import { useCallback, useEffect, useState } from 'react';
import { getPushPublicKey, savePushSubscription, deletePushSubscription, sendTestPush } from '../api/pushApi';
import { addLog, flushLogs } from '../utils/tracking';

export type PushState = 'unsupported' | 'denied' | 'off' | 'on' | 'busy';

export interface PushResult {
  ok: boolean;
  message: string;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** Reports a push step to the client log at once, so failures on a phone can be read on the server. */
function logPush(step: string, details: string, metadata?: Record<string, unknown>) {
  addLog({ type: 'push', page: 'push', details: `${step}: ${details}`.slice(0, 480), metadata: { step, ...metadata } });
  flushLogs();
}

/** The service worker registration, or an error naming why there is none within 10s. */
async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing?.active) return existing;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Service worker not ready; reopen the app')), 10000)),
  ]);
}

function describe(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { name?: string; message?: string; response?: { status?: number; data?: { error?: string } } };
    if (e.response) return `Server ${e.response.status}: ${e.response.data?.error ?? ''}`.trim();
    return [e.name, e.message].filter(Boolean).join(': ');
  }
  return String(err);
}

/** Turns this device's admin notifications on or off via Web Push, sending a test on enable. */
export function usePushNotifications() {
  const [state, setState] = useState<PushState>(isSupported() ? 'busy' : 'unsupported');

  useEffect(() => {
    if (!isSupported()) return;
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }
    let cancelled = false;
    getRegistration()
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (cancelled) return;
        // Only "on" when the browser has a subscription and permission is still granted.
        setState(sub && Notification.permission === 'granted' ? 'on' : 'off');
        // Re-send so the server still has it after a database reset.
        if (sub) savePushSubscription(sub.toJSON()).catch((err) => logPush('resave', describe(err)));
      })
      .catch(() => !cancelled && setState('off'));
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async (): Promise<PushResult> => {
    setState('busy');
    let step = 'permission';
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        logPush(step, permission);
        return { ok: false, message: 'Notifications were not allowed. Allow them in Chrome’s site settings.' };
      }
      step = 'public-key';
      const key = await getPushPublicKey();
      if (!key) {
        setState('off');
        logPush(step, 'server has no key');
        return { ok: false, message: 'The server has no notification keys. Check VAPID settings in Azure.' };
      }
      step = 'service-worker';
      const reg = await getRegistration();
      step = 'subscribe';
      const applicationServerKey = urlBase64ToUint8Array(key) as BufferSource;
      let sub = await reg.pushManager.getSubscription();
      if (sub) {
        // A subscription made with an older key cannot receive with the new one.
        await sub.unsubscribe().catch(() => {});
      }
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      step = 'save';
      await savePushSubscription(sub.toJSON());
      step = 'test';
      const test = await sendTestPush(sub.endpoint);
      setState('on');
      logPush(step, test.ok ? 'sent' : test.error ?? 'failed', { host: new URL(sub.endpoint).host });
      return test.ok
        ? { ok: true, message: 'Alerts on. A test notification is on its way.' }
        : { ok: false, message: `Alerts registered, but the test failed: ${test.error}` };
    } catch (err) {
      setState('off');
      const reason = describe(err);
      logPush(step, reason);
      return { ok: false, message: `Couldn’t turn on alerts (${step}): ${reason}` };
    }
  }, []);

  const disable = useCallback(async (): Promise<PushResult> => {
    setState('busy');
    try {
      const reg = await getRegistration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint).catch(() => {});
        await sub.unsubscribe();
      }
      setState('off');
      return { ok: true, message: 'Alerts off for this phone.' };
    } catch (err) {
      setState('on');
      logPush('disable', describe(err));
      return { ok: false, message: `Couldn’t turn off alerts: ${describe(err)}` };
    }
  }, []);

  return { state, enable, disable };
}
