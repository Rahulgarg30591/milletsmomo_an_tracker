import type { QueryClient } from '@tanstack/react-query';
import { getAdminSummary, getMinimumSaleValue } from '../api/adminApi';
import { getClosingCash, getClosingStock } from '../api/closingStockApi';
import { getDayExpenses } from '../api/expenseApi';
import { getCylinderRefills } from '../api/cylinderApi';
import { getLeaveMonth, getTakeawayMonth } from '../api/staffApi';
import { buildSalesText, buildLeavesText, buildTakeawaysText, toDDMMMYYYY } from './dayDetails';
import { buildExpensesText } from './expensesText';
import { buildClosingSummary } from './closingSummary';

/**
 * The admin's single end-of-day message. The date heads it once, then:
 * expenses, leaves, take aways, closing stock, sales. Reads through the query
 * cache under the pages' own keys; fetchQuery still refetches stale data.
 */
export async function fetchDaySummary(qc: QueryClient, date: string): Promise<string> {
  const month = date.slice(0, 7);
  const [expenses, refills, cash, summary, minimumSale, closing, leaveMonth, takeawayMonth] = await Promise.all([
    qc.fetchQuery({ queryKey: ['dayExpenses', date], queryFn: () => getDayExpenses(date) }),
    qc.fetchQuery({ queryKey: ['cylinders', date], queryFn: () => getCylinderRefills(date) }),
    qc.fetchQuery({ queryKey: ['closingCash', date], queryFn: () => getClosingCash(date) }),
    qc.fetchQuery({ queryKey: ['adminSummary', date, date], queryFn: () => getAdminSummary(date) }),
    qc.fetchQuery({ queryKey: ['minimumSaleValue', date], queryFn: () => getMinimumSaleValue(date) }),
    qc.fetchQuery({ queryKey: ['closingStock', date], queryFn: () => getClosingStock(date) }),
    qc.fetchQuery({ queryKey: ['staffLeaves', month], queryFn: () => getLeaveMonth(month) }),
    qc.fetchQuery({ queryKey: ['staffTakeaways', month], queryFn: () => getTakeawayMonth(month) }),
  ]);

  const expensesText = buildExpensesText(date, expenses.items, refills, { withDate: false });
  const momos = closing.items.filter((i) => i.category === 'momo_packet');
  const stock = closing.isSubmitted
    ? `Closing Stock\n${buildClosingSummary(
      date,
      momos.map((i) => ({ displayName: i.displayName, packets: i.packetsLeft, pieces: i.piecesLeft, wastage: i.wastagePieces })),
      { withDate: false },
    )}`
    : 'Closing Stock\nNot recorded yet';

  return [
    `Date: ${toDDMMMYYYY(date)}`,
    expensesText.text,
    buildLeavesText(leaveMonth.leaves.filter((l) => l.leaveDate === date)),
    buildTakeawaysText(takeawayMonth.takeaways.filter((t) => t.takeawayDate === date)),
    stock,
    buildSalesText({
      expenses: expensesText.total,
      cash: cash.amount,
      upi: summary.upiTotal,
      minimumSale: minimumSale ? minimumSale.totalMinimumSaleValue : null,
    }),
  ].join('\n\n');
}
