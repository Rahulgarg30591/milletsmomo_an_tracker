import { describe, it, expect } from 'vitest';
import { buildClosingSummary } from '../closingSummary';

describe('buildClosingSummary', () => {
  it('lists leftovers and wastage per filling, in the staff message format', () => {
    const text = buildClosingSummary('2026-09-26', [
      { displayName: 'Veg Momo Packet', packets: 0, pieces: 10, wastage: 1 },
      { displayName: 'Paneer Momo Packet', packets: 1, pieces: 12, wastage: 0 },
      { displayName: 'CheeseCorn Momo Packet', packets: 2, pieces: 0, wastage: 0 },
    ]);
    expect(text).toBe([
      'Data: 26-09-2026',
      '',
      'Left Over:',
      'Veg: 10 Pieces',
      'Paneer: 1 Packet and 12 pieces',
      'Cheese Corn: 2 Packets',
      '',
      'Wastage:',
      'Veg: 1 piece',
    ].join('\n'));
  });

  it('says None when nothing was wasted, and 0 for an empty filling', () => {
    const text = buildClosingSummary('2026-09-26', [{ displayName: 'Veg Momo Packet', packets: 0, pieces: 0, wastage: 0 }]);
    expect(text).toContain('Veg: 0');
    expect(text.endsWith('Wastage:\nNone')).toBe(true);
  });
});
