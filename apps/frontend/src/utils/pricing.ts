import { buildMenu } from 'shared';

const menu = buildMenu();

export function computeHalfPrice(fullPrice: number): number {
  return Math.round((fullPrice + 11) / 2);
}

export function calculateLineTotal(
  menuItemId: number,
  quantity: number,
  isHalf: boolean,
  isCustom: boolean,
): { unitPrice: number; lineTotal: number } {
  const item = menu.find((m) => m.id === menuItemId);
  if (!item) {
    return { unitPrice: 0, lineTotal: 0 };
  }
  // Half plate preset: exactly 3 momos at half price
  if (isHalf && !isCustom && quantity === 3) {
    return { unitPrice: item.halfPrice, lineTotal: item.halfPrice };
  }
  // Full plate preset: exactly 6 momos at full price
  if (!isHalf && !isCustom && quantity === 6) {
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

export function calculateOrderTotal(
  items: { menuItemId: number; quantity: number; isHalf: boolean; isCustom: boolean }[],
): number {
  return items.reduce((sum, item) => {
    const { lineTotal } = calculateLineTotal(item.menuItemId, item.quantity, item.isHalf, item.isCustom);
    return sum + lineTotal;
  }, 0);
}

export function getMenuItem(menuItemId: number) {
  return menu.find((m) => m.id === menuItemId);
}
