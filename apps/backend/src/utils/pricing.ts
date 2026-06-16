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
  const unitPrice = isHalf ? item.halfPrice : item.fullPrice;
  return { unitPrice, lineTotal: unitPrice * quantity };
}

export function computeOrderTotal(
  items: { menuItemId: number; quantity: number; isHalf: boolean }[],
): number {
  return items.reduce((sum, item) => {
    const { lineTotal } = computeLineTotal(item.menuItemId, item.quantity, item.isHalf);
    return sum + lineTotal;
  }, 0);
}
