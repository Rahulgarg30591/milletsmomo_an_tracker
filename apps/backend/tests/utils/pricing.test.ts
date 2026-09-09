import { describe, it, expect } from 'vitest';
import { computeLineTotal, computeOrderTotal } from '../../src/utils/pricing.js';
import { buildMenu, BEVERAGE_CATEGORY } from '../../src/constants/menu.js';

const menu = buildMenu();
const coldDrink = menu.find((m) => m.displayName === 'Cold Drink')!;
const water = menu.find((m) => m.displayName === 'Water')!;
const vegSteam = menu.find((m) => m.displayName === 'Veg Steam')!;

describe('beverage menu items', () => {
  it('places beverages in their own category, outside the momo grid', () => {
    expect(coldDrink.preparation).toBe(BEVERAGE_CATEGORY);
    expect(water.preparation).toBe(BEVERAGE_CATEGORY);
    expect(coldDrink.isBeverage).toBe(true);
    expect(water.isBeverage).toBe(true);
  });

  it('assigns the ids that MenuItems rows are seeded with', () => {
    // OrderItems.menu_item_id is a FK to MenuItems(id); momos hold 1-28.
    expect(coldDrink.id).toBe(29);
    expect(water.id).toBe(30);
  });

  it('prices beverages flat, per unit', () => {
    expect(coldDrink.fullPrice).toBe(10);
    expect(water.fullPrice).toBe(20);
  });

  it('leaves momo ids untouched', () => {
    expect(vegSteam.id).toBe(1);
    expect(menu.filter((m) => !m.isBeverage)).toHaveLength(28);
  });
});

describe('computeLineTotal for beverages', () => {
  it('multiplies unit price by quantity', () => {
    expect(computeLineTotal(coldDrink.id, 1, false)).toEqual({ unitPrice: 10, lineTotal: 10 });
    expect(computeLineTotal(coldDrink.id, 3, false)).toEqual({ unitPrice: 10, lineTotal: 30 });
    expect(computeLineTotal(water.id, 2, false)).toEqual({ unitPrice: 20, lineTotal: 40 });
  });

  it('ignores plate math at momo-significant quantities', () => {
    // 3 and 6 are the half/full plate presets for momos; a beverage must not
    // fall through to plate pricing at those counts.
    expect(computeLineTotal(water.id, 3, true).lineTotal).toBe(60);
    expect(computeLineTotal(water.id, 6, false).lineTotal).toBe(120);
  });

  it('ignores isHalf entirely', () => {
    expect(computeLineTotal(coldDrink.id, 4, true).lineTotal).toBe(40);
    expect(computeLineTotal(coldDrink.id, 4, false).lineTotal).toBe(40);
  });
});

describe('computeOrderTotal with a mixed order', () => {
  it('adds flat beverage lines to momo plate pricing', () => {
    const total = computeOrderTotal([
      { menuItemId: vegSteam.id, quantity: 6, isHalf: false }, // full plate = 89
      { menuItemId: coldDrink.id, quantity: 2, isHalf: false }, // 2 x 10 = 20
      { menuItemId: water.id, quantity: 1, isHalf: false }, // 1 x 20 = 20
    ]);
    expect(total).toBe(vegSteam.fullPrice + 20 + 20);
  });

  it('still prices a momo-only order the same as before', () => {
    expect(computeOrderTotal([{ menuItemId: vegSteam.id, quantity: 3, isHalf: true }])).toBe(
      vegSteam.halfPrice,
    );
  });
});
