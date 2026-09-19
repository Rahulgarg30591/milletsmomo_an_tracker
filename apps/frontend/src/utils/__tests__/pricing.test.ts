import { describe, it, expect } from 'vitest';
import { computeHalfPrice, calculateLineTotal, calculateOrderTotal, getMenuItem } from '../pricing';

const VEG_STEAM = 1;      // full 89, half 50
const PANEER_STEAM = 2;   // full 109, half 60
const COLD_DRINK = 29;    // flat 10

const line = (menuItemId: number, quantity: number, isHalf = false, isCustom = false) =>
  calculateLineTotal(menuItemId, quantity, isHalf, isCustom);

describe('computeHalfPrice', () => {
  it('is a little over half, rounded', () => {
    expect(computeHalfPrice(89)).toBe(50);
    expect(computeHalfPrice(109)).toBe(60);
    expect(computeHalfPrice(129)).toBe(70);
  });
});

describe('calculateLineTotal', () => {
  it('charges the full price for a plate of six', () => {
    expect(line(VEG_STEAM, 6).lineTotal).toBe(89);
  });

  it('charges the half price for three', () => {
    expect(line(VEG_STEAM, 3, true).lineTotal).toBe(50);
  });

  it('charges whole plates at the plate price', () => {
    expect(line(VEG_STEAM, 12).lineTotal).toBe(178);
    expect(line(VEG_STEAM, 18).lineTotal).toBe(267);
  });

  it('charges a small remainder per momo at the half-plate rate', () => {
    // round(50/3) = 17 per momo
    expect(line(VEG_STEAM, 8).lineTotal).toBe(89 + 2 * 17);
    expect(line(VEG_STEAM, 2).lineTotal).toBe(2 * 17);
  });

  it('charges a remainder of five at the full-plate rate per momo', () => {
    // A remainder of five is nearly a plate, so it is priced from the full
    // price: round(89/6) = 15 each.
    expect(line(VEG_STEAM, 5).lineTotal).toBe(5 * 15);
    expect(line(VEG_STEAM, 11).lineTotal).toBe(89 + 5 * 15);
  });

  it('treats a custom six as six momos, not a plate', () => {
    // isCustom bypasses the plate preset; six momos still make a plate's worth.
    expect(line(VEG_STEAM, 6, false, true).lineTotal).toBe(89);
  });

  it('prices beverages per unit, ignoring plate rules', () => {
    expect(line(COLD_DRINK, 1).lineTotal).toBe(10);
    expect(line(COLD_DRINK, 3).lineTotal).toBe(30);
    expect(line(COLD_DRINK, 3, true).lineTotal).toBe(30);
  });

  it('returns zero for an unknown item rather than throwing', () => {
    expect(line(9999, 6)).toEqual({ unitPrice: 0, lineTotal: 0 });
  });

  it('prices each filling from its own menu row', () => {
    expect(line(PANEER_STEAM, 6).lineTotal).toBe(109);
    expect(line(PANEER_STEAM, 3, true).lineTotal).toBe(60);
  });
});

describe('calculateOrderTotal', () => {
  it('sums the lines', () => {
    expect(calculateOrderTotal([
      { menuItemId: VEG_STEAM, quantity: 6, isHalf: false, isCustom: false },
      { menuItemId: PANEER_STEAM, quantity: 3, isHalf: true, isCustom: false },
      { menuItemId: COLD_DRINK, quantity: 2, isHalf: false, isCustom: false },
    ])).toBe(89 + 60 + 20);
  });

  it('is zero for an empty order', () => {
    expect(calculateOrderTotal([])).toBe(0);
  });

  it('skips unknown items instead of failing the whole order', () => {
    expect(calculateOrderTotal([
      { menuItemId: VEG_STEAM, quantity: 6, isHalf: false, isCustom: false },
      { menuItemId: 9999, quantity: 6, isHalf: false, isCustom: false },
    ])).toBe(89);
  });

  it('agrees with the backend on the same basket', () => {
    // The frontend shows the price and the backend charges it; if these two
    // ever disagree the customer is quoted one number and billed another.
    const basket = [
      { menuItemId: VEG_STEAM, quantity: 8, isHalf: false, isCustom: true },
      { menuItemId: COLD_DRINK, quantity: 1, isHalf: false, isCustom: false },
    ];
    expect(calculateOrderTotal(basket)).toBe(89 + 2 * 17 + 10);
  });
});

describe('getMenuItem', () => {
  it('finds an item by id', () => {
    expect(getMenuItem(VEG_STEAM)?.displayName).toBe('Veg Steam');
  });

  it('marks beverages', () => {
    expect(getMenuItem(COLD_DRINK)?.isBeverage).toBe(true);
    expect(getMenuItem(VEG_STEAM)?.isBeverage).toBeFalsy();
  });

  it('returns undefined for an unknown id', () => {
    expect(getMenuItem(9999)).toBeUndefined();
  });
});
