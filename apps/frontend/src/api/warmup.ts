import { client } from './client';

const WARMUP_INTERVAL_MS = 30_000;
let lastWarmupAt = 0;

/**
 * Nudges the API so a cold Functions instance and a paused Azure SQL database
 * start waking immediately.
 *
 * The app is used from long-lived mobile browser tabs. By the time someone
 * returns to a backgrounded tab both the Functions instance and the serverless
 * database are usually cold, and a resume takes tens of seconds — so the first
 * real request used to fail. Firing this on page load and on tab focus spends
 * that resume time while the user is still typing their PIN.
 *
 * Fire-and-forget and self-throttling; failures are expected and ignored.
 */
export function warmUpApi(): void {
  const now = Date.now();
  if (now - lastWarmupAt < WARMUP_INTERVAL_MS) return;
  lastWarmupAt = now;

  client.get('/health', { timeout: 40_000 }).catch(() => {});
}
