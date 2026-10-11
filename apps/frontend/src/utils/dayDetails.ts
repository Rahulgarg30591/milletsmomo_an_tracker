const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** YYYY-MM-DD to DD-MMM-YYYY, e.g. 2026-10-11 to 11-Oct-2026. */
export function toDDMMMYYYY(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}-${MONTHS[Number(m) - 1]}-${y}`;
}

/** Rupees with at most two decimals and Indian digit grouping. */
function rupees(n: number): string {
  return `₹${(Math.round(n * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export interface DayDetailsInput {
  date: string;
  expenses: number;
  /** Cash staff entered at close; null when not entered yet. */
  cash: number | null;
  upi: number;
  /** Null when the minimum sale cannot be worked out for the day. */
  minimumSale: number | null;
}

/** The admin's "Copy Day Details" message. Total = expenses + cash entered + UPI. */
export function buildDayDetails({ date, expenses, cash, upi, minimumSale }: DayDetailsInput): string {
  const total = expenses + (cash ?? 0) + upi;
  return [
    `Date: ${toDDMMMYYYY(date)}`,
    `Expenses: ${rupees(expenses)}`,
    `Cash Collection: ${cash === null ? 'not entered' : rupees(cash)}`,
    `UPI Collection: ${rupees(upi)}`,
    `Total: ${rupees(total)}`,
    '',
    `Minimum Sale: ${minimumSale === null ? 'not available' : rupees(minimumSale)}`,
  ].join('\n');
}
