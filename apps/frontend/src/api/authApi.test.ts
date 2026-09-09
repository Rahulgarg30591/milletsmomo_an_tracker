import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./client', () => ({
  client: { post: vi.fn() },
}));

import { client } from './client';
import { login } from './authApi';

const post = client.post as unknown as ReturnType<typeof vi.fn>;

function httpError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status } });
}

const CREDENTIALS = { role: 'staff' as const, pin: '9865' };
const SUCCESS = { data: { token: 't', role: 'staff', displayName: 'Cart Staff' } };

describe('login', () => {
  beforeEach(() => {
    post.mockReset();
    vi.useFakeTimers();
  });

  async function run(promise: Promise<unknown>) {
    const settled = promise.catch((err) => ({ __error: err }));
    await vi.runAllTimersAsync();
    return settled;
  }

  it('returns the response on first success', async () => {
    post.mockResolvedValueOnce(SUCCESS);
    await expect(run(login(CREDENTIALS))).resolves.toEqual(SUCCESS.data);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('retries a cold-start 503 and succeeds', async () => {
    post.mockRejectedValueOnce(httpError(503)).mockResolvedValueOnce(SUCCESS);
    await expect(run(login(CREDENTIALS))).resolves.toEqual(SUCCESS.data);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('retries a timeout with no response', async () => {
    post.mockRejectedValueOnce(new Error('timeout of 45000ms exceeded')).mockResolvedValueOnce(SUCCESS);
    await expect(run(login(CREDENTIALS))).resolves.toEqual(SUCCESS.data);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('never retries a wrong PIN', async () => {
    post.mockRejectedValue(httpError(401));
    const result: any = await run(login(CREDENTIALS));
    expect(result.__error.response.status).toBe(401);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('never retries a rate-limit response', async () => {
    post.mockRejectedValue(httpError(429));
    const result: any = await run(login(CREDENTIALS));
    expect(result.__error.response.status).toBe(429);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('gives up after three attempts and reports the last error', async () => {
    post.mockRejectedValue(httpError(500));
    const result: any = await run(login(CREDENTIALS));
    expect(result.__error.response.status).toBe(500);
    expect(post).toHaveBeenCalledTimes(3);
  });

  it('notifies the caller before each retry', async () => {
    post.mockRejectedValueOnce(httpError(503)).mockResolvedValueOnce(SUCCESS);
    const onRetry = vi.fn();
    await run(login(CREDENTIALS, { onRetry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
