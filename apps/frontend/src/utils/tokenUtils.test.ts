import { describe, it, expect } from 'vitest';
import { isTokenValid, decodeTokenSegment } from './tokenUtils';

function makeToken(payload: Record<string, unknown>): string {
  const encode = (value: string) => btoa(String.fromCharCode(...new TextEncoder().encode(value)));
  return `${encode('{"alg":"HS256"}')}.${encode(JSON.stringify(payload))}.sig`;
}

const FUTURE = Math.floor(Date.now() / 1000) + 3600;
const PAST = Math.floor(Date.now() / 1000) - 3600;

describe('isTokenValid', () => {
  it('accepts an unexpired token', () => {
    expect(isTokenValid(makeToken({ sub: '1', role: 'staff', exp: FUTURE }))).toBe(true);
  });

  it('accepts a token whose display name is not ASCII', () => {
    expect(isTokenValid(makeToken({ sub: '1', displayName: 'Café Owner ☕', exp: FUTURE }))).toBe(true);
  });

  it('decodes a multi-byte display name without mangling it', () => {
    const token = makeToken({ sub: '1', displayName: 'Café Owner ☕', exp: FUTURE });
    const payload = decodeTokenSegment(token.split('.')[1]) as { displayName: string };
    expect(payload.displayName).toBe('Café Owner ☕');
  });

  it('rejects an expired token', () => {
    expect(isTokenValid(makeToken({ sub: '1', exp: PAST }))).toBe(false);
  });

  it('rejects a token expiring inside the clock-skew buffer', () => {
    expect(isTokenValid(makeToken({ sub: '1', exp: Math.floor(Date.now() / 1000) + 5 }))).toBe(false);
  });

  it('rejects malformed and missing tokens', () => {
    expect(isTokenValid(null)).toBe(false);
    expect(isTokenValid('undefined')).toBe(false);
    expect(isTokenValid('not-a-token')).toBe(false);
    expect(isTokenValid(makeToken({ sub: '1' }))).toBe(false);
  });
});
