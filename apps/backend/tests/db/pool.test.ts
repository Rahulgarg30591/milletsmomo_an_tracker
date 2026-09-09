import { describe, it, expect } from 'vitest';
import { isTransientDbError } from '../../src/db/pool.js';

describe('isTransientDbError', () => {
  it('treats the Azure SQL serverless resume error as transient', () => {
    // 40613: "Database is not currently available" — raised while a paused
    // serverless database wakes up.
    expect(isTransientDbError(Object.assign(new Error('unavailable'), { number: 40613 }))).toBe(true);
  });

  it('treats a connect timeout as transient', () => {
    expect(isTransientDbError(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' }))).toBe(true);
  });

  it('treats a socket dropped by the Functions host as transient', () => {
    expect(isTransientDbError(Object.assign(new Error('closed'), { code: 'ECONNCLOSED' }))).toBe(true);
  });

  it('unwraps errors nested in originalError', () => {
    const wrapped = Object.assign(new Error('ConnectionError'), {
      code: 'EREQUEST',
      originalError: Object.assign(new Error('inner'), { number: 40197 }),
    });
    expect(isTransientDbError(wrapped)).toBe(true);
  });

  it('does not retry a genuine query error', () => {
    expect(isTransientDbError(Object.assign(new Error('Invalid column'), { number: 207 }))).toBe(false);
  });

  it('does not retry an authorization failure', () => {
    expect(isTransientDbError(Object.assign(new Error('Invalid PIN'), { status: 401 }))).toBe(false);
  });

  it('tolerates non-error values', () => {
    expect(isTransientDbError(null)).toBe(false);
    expect(isTransientDbError(undefined)).toBe(false);
    expect(isTransientDbError('boom')).toBe(false);
  });

  it('does not loop forever on a self-referential originalError', () => {
    const cyclic: any = new Error('cyclic');
    cyclic.originalError = cyclic;
    expect(isTransientDbError(cyclic)).toBe(false);
  });
});
