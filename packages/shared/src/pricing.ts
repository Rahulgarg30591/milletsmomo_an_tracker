import { buildMenu } from './menu';

const menu = buildMenu();

export function computeHalfPrice(fullPrice: number): number {
  return Math.round((fullPrice + 11) / 2);
}

export function calculateOrderTotal(
  items: { menuItemId: number; quantity: number; isHalf: boolean }[],
): number {
  let total = 0;
  for (const item of items) {
    const menuItem = menu.find((m) => m.id === item.menuItemId);
    if (!menuItem) continue;
    const price = item.isHalf ? menuItem.halfPrice : menuItem.fullPrice;
    total += price * item.quantity;
  }
  return total;
}