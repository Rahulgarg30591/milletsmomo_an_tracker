const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** YYYY-MM-DD to DD-MMM-YYYY, e.g. 2026-10-11 to 11-Oct-2026. */
export function toDDMMMYYYY(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}-${MONTHS[Number(m) - 1]}-${y}`;
}

/** Rupees with at most two decimals and Indian digit grouping. */
export function rupees(n: number): string {
  return `₹${(Math.round(n * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export interface SalesInput {
  expenses: number;
  /** Cash staff entered at close; null when not entered yet. */
  cash: number | null;
  upi: number;
  /** Null when the minimum sale cannot be worked out for the day. */
  minimumSale: number | null;
}

/** The sales block of the day summary. Total = expenses + cash entered + UPI. */
export function buildSalesText({ expenses, cash, upi, minimumSale }: SalesInput): string {
  const total = expenses + (cash ?? 0) + upi;
  return [
    'Sales',
    `Expenses: ${rupees(expenses)}`,
    `Cash Collection: ${cash === null ? 'not entered' : rupees(cash)}`,
    `UPI Collection: ${rupees(upi)}`,
    `Total: ${rupees(total)}`,
    `Minimum Sale: ${minimumSale === null ? 'not available' : rupees(minimumSale)}`,
  ].join('\n');
}

/** Who was absent, one per line. */
export function buildLeavesText(leaves: { staffName: string; reason: string | null }[]): string {
  if (leaves.length === 0) return 'Leaves\nNone';
  return ['Leaves', ...leaves.map((l, i) => `${i + 1}. ${l.staffName}${l.reason ? ` (${l.reason})` : ''}`)].join('\n');
}

/** What each staff member took, in plates, and what they owe after the discount. */
export function buildTakeawaysText(
  takeaways: { staffName: string; amountOwed: number; items: { itemName: string; quantity: number; isHalf: boolean }[] }[],
): string {
  if (takeaways.length === 0) return 'Take Aways\nNone';
  const lines = ['Take Aways'];
  takeaways.forEach((t, i) => {
    const items = t.items
      .map((it) => {
        const plates = it.quantity / (it.isHalf ? 3 : 6);
        return `${Number.isInteger(plates) ? plates : plates.toFixed(2)} ${it.isHalf ? 'half ' : ''}${it.itemName}`;
      })
      .join(', ');
    lines.push(`${i + 1}. ${t.staffName}: ${items} (owes ${rupees(t.amountOwed)})`);
  });
  lines.push(`Total owed: ${rupees(takeaways.reduce((s, t) => s + t.amountOwed, 0))}`);
  return lines.join('\n');
}
