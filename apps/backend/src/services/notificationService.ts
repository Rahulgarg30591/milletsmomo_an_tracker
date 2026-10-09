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

/**
 * Configures web-push from VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT.
 * Read lazily: local.settings.json is merged into process.env by db/pool.ts.
 * Without keys, push is off and every send is a no-op.
 */
function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    configured = false;
    return configured;
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@milletsmomo.local', publicKey, privateKey);
  configured = true;
  return configured;
}

/** The public VAPID key browsers subscribe with, or null when push is off. */
export function getPublicKey(): string | null {
  return ensureConfigured() ? process.env.VAPID_PUBLIC_KEY! : null;
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

/** Admin actions are not pushed back to the admin. */
export function isStaffActor(role: string | undefined): boolean {
  return role !== 'admin';
}
