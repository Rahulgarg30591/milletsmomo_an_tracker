import { describe, it, expect } from 'vitest';
import { buildSalesText, buildLeavesText, buildTakeawaysText, toDDMMMYYYY } from '../dayDetails';

describe('day summary blocks', () => {
  it('formats the date as DD-MMM-YYYY', () => {
    expect(toDDMMMYYYY('2026-10-01')).toBe('01-Oct-2026');
  });

  it('adds expenses, cash entered and UPI into the sales total', () => {
    expect(buildSalesText({ expenses: 350, cash: 4200, upi: 5894, minimumSale: 10160.84 })).toBe(
      'Sales\nExpenses: ₹350\nCash Collection: ₹4,200\nUPI Collection: ₹5,894\nTotal: ₹10,444\nMinimum Sale: ₹10,160.84',
    );
  });

  it('says when cash or minimum sale is missing', () => {
    const text = buildSalesText({ expenses: 0, cash: null, upi: 100, minimumSale: null });
    expect(text).toContain('Cash Collection: not entered');
    expect(text).toContain('Total: ₹100');
    expect(text).toContain('Minimum Sale: not available');
  });

  it('lists leaves, or None', () => {
    expect(buildLeavesText([])).toBe('Leaves\nNone');
    expect(buildLeavesText([{ staffName: 'Ramesh', reason: 'Fever' }, { staffName: 'Suresh', reason: null }]))
      .toBe('Leaves\n1. Ramesh (Fever)\n2. Suresh');
  });

  it('lists takeaways in plates with what is owed', () => {
    expect(buildTakeawaysText([])).toBe('Take Aways\nNone');
    expect(buildTakeawaysText([{
      staffName: 'Ramesh',
      amountOwed: 104.25,
      items: [{ itemName: 'Veg Steam', quantity: 6, isHalf: false }, { itemName: 'Paneer Fried', quantity: 3, isHalf: true }],
    }])).toBe('Take Aways\n1. Ramesh: 1 Veg Steam, 1 half Paneer Fried (owes ₹104.25)\nTotal owed: ₹104.25');
  });
});
