import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatDate, getToday, getYesterday, formatDateLabel } from '../dateUtils';

afterEach(() => vi.useRealTimers());

describe('formatDate', () => {
  it('renders as YYYY-MM-DD', () => {
    expect(formatDate(new Date('2026-09-18T12:00:00Z'))).toBe('2026-09-18');
  });

  it('uses the shop\'s timezone, not the machine\'s', () => {
    // 20:00 UTC is already the next day in IST, and the business day must
    // follow the shop rather than wherever the browser happens to be.
    expect(formatDate(new Date('2026-09-18T20:00:00Z'))).toBe('2026-09-19');
  });

  it('keeps an early-morning IST time on the same day', () => {
    expect(formatDate(new Date('2026-09-18T01:00:00Z'))).toBe('2026-09-18');
  });
});

describe('getToday and getYesterday', () => {
  it('returns the current business day', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-09-18T12:00:00Z'));
    expect(getToday()).toBe('2026-09-18');
  });

  it('returns the day before', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-09-18T12:00:00Z'));
    expect(getYesterday()).toBe('2026-09-17');
  });

  it('steps back across a month boundary', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-09-01T12:00:00Z'));
    expect(getYesterday()).toBe('2026-08-31');
  });
});

describe('formatDateLabel', () => {
  // The month's short name varies with the ICU data Node ships ("Sep" vs
  // "Sept"), so these assert the day and year — the parts a timezone bug
  // would move — rather than the exact spelling.
  it('keeps the day it was given', () => {
    const label = formatDateLabel('2026-09-18');
    expect(label).toMatch(/^18 /);
    expect(label).toContain('2026');
  });

  it('does not slip to the previous day at the start of a month', () => {
    const label = formatDateLabel('2026-09-01');
    expect(label).toMatch(/^1 /);
    expect(label).not.toContain('Aug');
  });

  it('does not slip at the start of a year', () => {
    expect(formatDateLabel('2026-01-01')).toContain('2026');
  });
});
