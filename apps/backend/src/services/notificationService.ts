import webpush from 'web-push';
import { query } from '../db/pool.js';

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushMessage {
  title: string;
  body: string;
  /** Path the notification opens when tapped. */
  url?: string;
  /** Same-tag notifications replace each other on the device. */
  tag?: string;
}

/** An order total above this sends the admin a notification. */
export const LARGE_ORDER_THRESHOLD = 400;

let configured: boolean | null = null;
let publicKeyValue: string | null = null;
/** Why push is off, for the admin's error message; null when on. */
let configError: string | null = null;

/** Strips what pasting into a settings box tends to add: quotes, spaces, newlines, base64 padding. */
function cleanKey(value: string | undefined): string {
  return (value ?? '').trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '').replace(/=+$/, '');
}

/** web-push accepts only a mailto: or https: subject; a bare email is given mailto:. */
function cleanSubject(value: string | undefined): string {
  const v = (value ?? '').trim().replace(/^["']|["']$/g, '').replace(/^<|>$/g, '');
  if (!v || v.includes('<') || v.includes('>')) return 'mailto:admin@milletsmomo.local';
  if (/^(mailto:|https:\/\/)/i.test(v)) return v;
  return v.includes('@') ? `mailto:${v}` : 'mailto:admin@milletsmomo.local';
}

/**
 * Configures web-push from VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT.
 * Read lazily: local.settings.json is merged into process.env by db/pool.ts.
 * Without valid keys push is off, every send is a no-op, and configError says
 * why. Never throws: a bad setting must not turn into a 500.
 */
function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = cleanKey(process.env.VAPID_PUBLIC_KEY);
  const privateKey = cleanKey(process.env.VAPID_PRIVATE_KEY);
  if (!publicKey || !privateKey) {
    configError = 'VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY is not set on the server';
    configured = false;
    return configured;
  }
  try {
    webpush.setVapidDetails(cleanSubject(process.env.VAPID_SUBJECT), publicKey, privateKey);
    publicKeyValue = publicKey;
    configured = true;
  } catch (err: any) {
    configError = `VAPID settings rejected: ${err?.message ?? err}`;
    console.warn(configError);
    configured = false;
  }
  return configured;
}

/** The public VAPID key browsers subscribe with, or null when push is off. */
export function getPublicKey(): string | null {
  return ensureConfigured() ? publicKeyValue : null;
}

/** Why push is off, or null when it is on. */
export function getConfigError(): string | null {
  ensureConfigured();
  return configError;
}

/** Saves (or re-points to this user) a device's push subscription. */
export async function saveSubscription(sub: PushSubscriptionInput, userId: number): Promise<void> {
  await query(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_id = EXCLUDED.user_id`,
    [sub.endpoint, sub.keys.p256dh, sub.keys.auth, userId],
  );
}

/** Removes a device's push subscription. */
export async function deleteSubscription(endpoint: string): Promise<void> {
  await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
}

/**
 * Sends a notification to every subscribed admin device. Never throws: a
 * failed push must not fail the staff action that triggered it. Endpoints the
 * push service reports gone (404/410) are deleted.
 */
export async function notifyAdmins(message: PushMessage): Promise<void> {
  try {
    if (!ensureConfigured()) return;
    const subs = await query<{ endpoint: string; p256dh: string; auth: string }>(
      `SELECT s.endpoint, s.p256dh, s.auth
       FROM push_subscriptions s JOIN users u ON u.id = s.user_id
       WHERE u.role = 'admin' AND u.is_active`,
    );
    const payload = JSON.stringify(message);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 6 * 3600, timeout: 5000 },
          );
        } catch (err: any) {
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await deleteSubscription(s.endpoint).catch(() => {});
          } else {
            console.warn('push failed', err?.statusCode ?? err?.message);
          }
        }
      }),
    );
  } catch (err: any) {
    console.warn('notifyAdmins failed', err?.message);
  }
}

/**
 * Sends a test notification to one device and reports the push service's
 * answer, so the admin can see at once whether alerts reach the phone.
 */
export async function sendTest(endpoint: string): Promise<{ ok: boolean; error?: string }> {
  if (!ensureConfigured()) return { ok: false, error: 'Server has no VAPID keys' };
  const rows = await query<{ endpoint: string; p256dh: string; auth: string }>(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE endpoint = $1',
    [endpoint],
  );
  if (rows.length === 0) return { ok: false, error: 'This phone is not registered' };
  const s = rows[0];
  try {
    await webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      JSON.stringify({ title: 'Alerts are on', body: 'This phone will get Millets Momo alerts.', url: '/admin', tag: 'test' }),
      { TTL: 600, timeout: 8000 },
    );
    return { ok: true };
  } catch (err: any) {
    if (err?.statusCode === 404 || err?.statusCode === 410) await deleteSubscription(s.endpoint).catch(() => {});
    return { ok: false, error: `Push service answered ${err?.statusCode ?? ''} ${String(err?.body ?? err?.message ?? '').slice(0, 200)}`.trim() };
  }
}

/** Admin actions are not pushed back to the admin. */
export function isStaffActor(role: string | undefined): boolean {
  return role !== 'admin';
}
