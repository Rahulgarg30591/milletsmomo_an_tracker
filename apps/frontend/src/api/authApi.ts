import { client } from './client';
import type { LoginRequest, LoginResponse } from 'shared';

/** Generous: a paused Azure SQL database can take ~30s to resume. */
const LOGIN_TIMEOUT_MS = 45_000;
const LOGIN_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 1200;

/**
 * True when a login failure reflects infrastructure rather than the PIN.
 *
 * A wrong PIN (401), bad input (400) and rate limiting (429) are all final —
 * retrying them cannot help and burns the user's rate-limit budget. Timeouts,
 * dropped connections and 5xx are the cold-start signature, and login is
 * idempotent, so replaying it is safe.
 */
function isRetryable(err: any): boolean {
  const status = err?.response?.status;
  if (status === undefined) return true;
  return status >= 500;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface LoginOptions {
  /** Called before each retry so the UI can explain the wait. */
  onRetry?: (attempt: number) => void;
  signal?: AbortSignal;
}

/**
 * Logs in, retrying transient infrastructure failures.
 *
 * @param data - Role and 4-digit PIN.
 * @param options - Retry notification and cancellation.
 * @returns The signed token and user details.
 */
export async function login(data: LoginRequest, options: LoginOptions = {}): Promise<LoginResponse> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= LOGIN_ATTEMPTS; attempt++) {
    try {
      const res = await client.post('/auth/login', data, {
        timeout: LOGIN_TIMEOUT_MS,
        signal: options.signal,
      });
      return res.data;
    } catch (err) {
      lastError = err;
      if (options.signal?.aborted) throw err;
      if (attempt === LOGIN_ATTEMPTS || !isRetryable(err)) throw err;
      options.onRetry?.(attempt);
      await delay(RETRY_BACKOFF_MS * attempt);
    }
  }

  throw lastError;
}
