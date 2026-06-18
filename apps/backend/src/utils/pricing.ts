import { buildMenu } from '../constants/menu.js';

const menu = buildMenu();

export function computeHalfPrice(fullPrice: number): number {
  return Math.round((fullPrice + 11) / 2);
}

export function computeLineTotal(
  menuItemId: number,
  quantity: number,
  isHalf: boolean,
): { unitPrice: number; lineTotal: number } {
  const item = menu.find((m) => m.id === menuItemId);
  if (!item) {
    throw Object.assign(new Error(`Menu item ${menuItemId} not found`), {
      status: 400,
    });
  }
  // Half plate preset: exactly 3 momos at half price
  if (isHalf && quantity === 3) {
    return { unitPrice: item.halfPrice, lineTotal: item.halfPrice };
  }
  // Full plate preset: exactly 6 momos at full price (not half, not custom)
  if (!isHalf && quantity === 6) {
    return { unitPrice: item.fullPrice, lineTotal: item.fullPrice };
  }
  // Custom quantity pricing
  const fullPlates = Math.floor(quantity / 6);
  const remainder = quantity % 6;
  let lineTotal: number;
  if (remainder === 0) {
    lineTotal = fullPlates * item.fullPrice;
  } else if (remainder <= 4) {
    const perMomo = Math.round(item.halfPrice / 3);
    lineTotal = fullPlates * item.fullPrice + remainder * perMomo;
  } else {
    // remainder === 5
    const perMomo = Math.round(item.fullPrice / 6);
    lineTotal = fullPlates * item.fullPrice + 5 * perMomo;
  }
  return { unitPrice: Math.round(item.halfPrice / 3), lineTotal };
}

export function computeOrderTotal(
  items: { menuItemId: number; quantity: number; isHalf: boolean }[],
): number {
  return items.reduce((sum, item) => {
    const { lineTotal } = computeLineTotal(item.menuItemId, item.quantity, item.isHalf);
    return sum + lineTotal;
  }, 0);
}
