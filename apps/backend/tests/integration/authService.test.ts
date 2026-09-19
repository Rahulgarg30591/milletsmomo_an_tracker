import { describe, it, expect } from 'vitest';
import { login } from '../../src/services/authService.js';
import { query } from '../../src/db/pool.js';
import { verifyToken } from '../../src/utils/simpleToken.js';

// PINs come from seed.sql.
const ADMIN_PIN = '1703';
const STAFF_PIN = '9865';
const STAFF_2_PIN = '5575';

describe('authService against a real database', () => {
  it('signs in an admin with the seeded PIN', async () => {
    const result = await login('admin', ADMIN_PIN);
    expect(result.role).toBe('admin');
    expect(result.displayName).toBe('Owner');
    expect(result.expiresIn).toBe(43200);
  });

  it('signs in staff with the seeded PIN', async () => {
    const result = await login('staff', STAFF_PIN);
    expect(result.role).toBe('staff');
  });

  it('matches the right person when a role has several accounts', async () => {
    // Both 'staff' and 'staff_2' hold the staff role; the PIN decides which.
    const first = await login('staff', STAFF_PIN);
    const second = await login('staff', STAFF_2_PIN);
    expect(first.displayName).toBe('Cart Staff');
    expect(second.displayName).toBe('Staff 2');
    expect(first.userId).not.toBe(second.userId);
  });

  it('issues a token that verifies and carries the user', async () => {
    const result = await login('admin', ADMIN_PIN);
    const payload = verifyToken(result.token);
    expect(payload).not.toBeNull();
    expect(payload!.role).toBe('admin');
    expect(payload!.sub).toBe(String(result.userId));
  });

  it('rejects a wrong PIN with 401', async () => {
    await expect(login('admin', '0000')).rejects.toMatchObject({ status: 401 });
  });

  it('rejects an unknown role with 401', async () => {
    await expect(login('nobody', ADMIN_PIN)).rejects.toMatchObject({ status: 401 });
  });

  it('will not sign in a deactivated account', async () => {
    await query(`UPDATE users SET is_active = FALSE WHERE username = 'admin'`);
    try {
      await expect(login('admin', ADMIN_PIN)).rejects.toMatchObject({ status: 401 });
    } finally {
      await query(`UPDATE users SET is_active = TRUE WHERE username = 'admin'`);
    }
  });

  it('does not leak the PIN hash to the caller', async () => {
    const result = await login('admin', ADMIN_PIN) as Record<string, unknown>;
    expect(Object.keys(result)).not.toContain('pin_hash');
  });
});
