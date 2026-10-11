import { describe, it, expect } from 'vitest';
import { buildDayDetails, toDDMMMYYYY } from '../dayDetails';

describe('buildDayDetails', () => {
  it('formats the date as DD-MMM-YYYY', () => {
    expect(toDDMMMYYYY('2026-10-01')).toBe('01-Oct-2026');
  });

  it('adds expenses, cash entered and UPI into the total', () => {
    expect(buildDayDetails({ date: '2026-10-11', expenses: 350, cash: 4200, upi: 5894, minimumSale: 10160.84 })).toBe(
      'Date: 11-Oct-2026\nExpenses: ₹350\nCash Collection: ₹4,200\nUPI Collection: ₹5,894\nTotal: ₹10,444\n\nMinimum Sale: ₹10,160.84',
    );
  });

  it('says when cash or minimum sale is missing', () => {
    const text = buildDayDetails({ date: '2026-10-11', expenses: 0, cash: null, upi: 100, minimumSale: null });
    expect(text).toContain('Cash Collection: not entered');
    expect(text).toContain('Total: ₹100');
    expect(text).toContain('Minimum Sale: not available');
  });
});
