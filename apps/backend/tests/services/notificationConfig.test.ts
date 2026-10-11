import { describe, it, expect, vi, beforeEach } from 'vitest';
import webpush from 'web-push';

vi.mock('../../src/db/pool.js', () => ({ query: vi.fn() }));

const keys = webpush.generateVAPIDKeys();

async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const k of ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT']) delete process.env[k];
  Object.assign(process.env, env);
  return import('../../src/services/notificationService.js');
}

describe('VAPID settings', () => {
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));

  it('accepts keys pasted with quotes and spaces, and a bare email subject', async () => {
    const svc = await load({
      VAPID_PUBLIC_KEY: ` "${keys.publicKey}" \n`,
      VAPID_PRIVATE_KEY: `'${keys.privateKey}'`,
      VAPID_SUBJECT: 'owner@example.com',
    });
    expect(svc.getPublicKey()).toBe(keys.publicKey);
    expect(svc.getConfigError()).toBeNull();
  });

  it('ignores a placeholder subject such as mailto:<your email>', async () => {
    const svc = await load({ VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: 'mailto:<your email>' });
    expect(svc.getPublicKey()).toBe(keys.publicKey);
  });

  it('reports a bad key instead of throwing', async () => {
    const svc = await load({ VAPID_PUBLIC_KEY: 'not-a-key', VAPID_PRIVATE_KEY: keys.privateKey });
    expect(svc.getPublicKey()).toBeNull();
    expect(svc.getConfigError()).toMatch(/VAPID settings rejected/);
  });

  it('reports missing keys', async () => {
    const svc = await load({});
    expect(svc.getPublicKey()).toBeNull();
    expect(svc.getConfigError()).toMatch(/not set/);
  });
});
