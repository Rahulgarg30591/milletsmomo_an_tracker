import { describe, it, expect } from 'vitest';
import { isTransientDbError } from '../../src/db/pool.js';

describe('isTransientDbError', () => {
  it('treats a backend terminated by the pooler as transient', () => {
    // 57P01: admin_shutdown — raised when Supabase's pooler recycles a backend.
    expect(isTransientDbError(Object.assign(new Error('terminating connection'), { code: '57P01' }))).toBe(true);
  });

  it('treats a connection failure as transient', () => {
    expect(isTransientDbError(Object.assign(new Error('could not connect'), { code: '08006' }))).toBe(true);
  });

  it('treats a deadlock as transient', () => {
    expect(isTransientDbError(Object.assign(new Error('deadlock detected'), { code: '40P01' }))).toBe(true);
  });

  it('treats a socket dropped by the Functions host as transient', () => {
    expect(isTransientDbError(Object.assign(new Error('reset'), { code: 'ECONNRESET' }))).toBe(true);
  });

  it('unwraps errors nested in cause', () => {
    const wrapped = Object.assign(new Error('query failed'), {
      code: 'UNKNOWN',
      cause: Object.assign(new Error('inner'), { code: 'ETIMEDOUT' }),
    });
    expect(isTransientDbError(wrapped)).toBe(true);
  });

  it('does not retry a genuine query error', () => {
    // 42703: undefined_column.
    expect(isTransientDbError(Object.assign(new Error('column does not exist'), { code: '42703' }))).toBe(false);
  });

  it('does not retry a constraint violation', () => {
    // 23505: unique_violation — retrying would just fail again.
    expect(isTransientDbError(Object.assign(new Error('duplicate key'), { code: '23505' }))).toBe(false);
  });

  it('does not retry an authorization failure', () => {
    expect(isTransientDbError(Object.assign(new Error('Invalid PIN'), { status: 401 }))).toBe(false);
  });

  it('tolerates non-error values', () => {
    expect(isTransientDbError(null)).toBe(false);
    expect(isTransientDbError(undefined)).toBe(false);
    expect(isTransientDbError('boom')).toBe(false);
  });

  it('does not loop forever on a self-referential cause', () => {
    const cyclic: any = new Error('cyclic');
    cyclic.cause = cyclic;
    expect(isTransientDbError(cyclic)).toBe(false);
  });
});
