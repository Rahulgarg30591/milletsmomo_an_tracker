import { buildMenu } from 'shared';

const menu = buildMenu();

export function computeHalfPrice(fullPrice: number): number {
  return Math.round((fullPrice + 11) / 2);
}

export function calculateLineTotal(
  menuItemId: number,
  quantity: number,
  isHalf: boolean,
): { unitPrice: number; lineTotal: number } {
  const item = menu.find((m) => m.id === menuItemId);
  if (!item) {
    return { unitPrice: 0, lineTotal: 0 };
  }
  const unitPrice = isHalf ? item.halfPrice : item.fullPrice;
  return { unitPrice, lineTotal: unitPrice * quantity };
}

export function calculateOrderTotal(
  items: { menuItemId: number; quantity: number; isHalf: boolean }[],
): number {
  return items.reduce((sum, item) => {
    const { lineTotal } = calculateLineTotal(item.menuItemId, item.quantity, item.isHalf);
    return sum + lineTotal;
  }, 0);
}

export function getMenuItem(menuItemId: number) {
  return menu.find((m) => m.id === menuItemId);
}
