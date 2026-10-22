import { client } from './client';

const WARMUP_INTERVAL_MS = 30_000;
let lastWarmupAt = 0;

/**
 * Nudges the API so a cold Functions instance and its database connection
 * start warming immediately.
 *
 * The app is used from long-lived mobile browser tabs. By the time someone
 * returns to a backgrounded tab the Functions instance is usually cold, and
 * the first real request pays for the start-up. Firing this on page load and
 * on tab focus spends that time while the user is still typing their PIN.
 *
 * Fire-and-forget and self-throttling; failures are expected and ignored.
 */
export function warmUpApi(): void {
  const now = Date.now();
  if (now - lastWarmupAt < WARMUP_INTERVAL_MS) return;
  lastWarmupAt = now;

  client.get('/health', { timeout: 40_000 }).catch(() => {});
}
