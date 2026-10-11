import { toDDMMYYYY } from './dateUtils';
import { brandInfo } from './cylinder';
import type { CylinderRefill } from '../types';

/**
 * The expenses message copied at day end: each expense, then each cylinder
 * refill, then the total. Shared by the staff and admin expense pages and the
 * admin day summary so all three copy the same text. The day summary leaves
 * the date out, as it heads the whole message.
 */
export function buildExpensesText(
  date: string,
  items: { description: string; amount: number }[],
  refills: Pick<CylinderRefill, 'brand' | 'source' | 'amount'>[],
  { withDate = true }: { withDate?: boolean } = {},
): { text: string; total: number } {
  const lines = withDate ? ['Expenses', toDDMMYYYY(date)] : ['Expenses'];
  items.forEach((e, i) => lines.push(`${i + 1}. ${e.description.trim()} ₹${e.amount}`));
  refills.forEach((r, i) => {
    lines.push(`${items.length + i + 1}. Cylinder (${[brandInfo(r.brand).short, r.source].filter(Boolean).join(', ')}) ₹${r.amount}`);
  });
  const total = items.reduce((s, e) => s + e.amount, 0) + refills.reduce((s, r) => s + r.amount, 0);
  lines.push(`Total: ₹${total.toFixed(2)}`);
  return { text: lines.join('\n'), total };
}
