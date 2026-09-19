import { describe, it, expect } from 'vitest';
import { formatQuantity } from '../formatQuantity';

describe('formatQuantity', () => {
  it('reads whole plates as plates', () => {
    expect(formatQuantity(6)).toBe('1 plate');
    expect(formatQuantity(12)).toBe('2 plates');
  });

  it('reads a half plate as a fraction of one', () => {
    expect(formatQuantity(3)).toBe('0.5 plates');
    expect(formatQuantity(9)).toBe('1.5 plates');
  });

  it('falls back to a count below a half plate', () => {
    expect(formatQuantity(1)).toBe('1x');
    expect(formatQuantity(2)).toBe('2x');
  });

  it('shows plates plus the leftover momos', () => {
    expect(formatQuantity(7)).toBe('7x (1 plate + 1)');
    expect(formatQuantity(14)).toBe('14x (2 plates + 2)');
  });

  it('counts beverages by the unit, never as plates', () => {
    expect(formatQuantity(1, true)).toBe('1x');
    expect(formatQuantity(6, true)).toBe('6x');
  });

  it('handles zero', () => {
    expect(formatQuantity(0)).toBe('0 plates');
  });
});
