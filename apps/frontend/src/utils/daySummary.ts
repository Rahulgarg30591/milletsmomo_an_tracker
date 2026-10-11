import type { QueryClient } from '@tanstack/react-query';
import { getAdminSummary, getMinimumSaleValue } from '../api/adminApi';
import { getClosingCash, getClosingStock } from '../api/closingStockApi';
import { getDayExpenses } from '../api/expenseApi';
import { getCylinderRefills } from '../api/cylinderApi';
import { buildDayDetails } from './dayDetails';
import { buildExpensesText } from './expensesText';
import { buildClosingSummary } from './closingSummary';

/**
 * The admin's single end-of-day message: sale details, then the expenses
 * message, then the closing-stock message. Reads through the query cache, so
 * data a page already loaded is not fetched again.
 */
export async function fetchDaySummary(qc: QueryClient, date: string): Promise<string> {
  const [expenses, refills, cash, summary, minimumSale, closing] = await Promise.all([
    qc.fetchQuery({ queryKey: ['dayExpenses', date], queryFn: () => getDayExpenses(date) }),
    qc.fetchQuery({ queryKey: ['cylinders', date], queryFn: () => getCylinderRefills(date) }),
    qc.fetchQuery({ queryKey: ['closingCash', date], queryFn: () => getClosingCash(date) }),
    qc.fetchQuery({ queryKey: ['adminSummary', date, date], queryFn: () => getAdminSummary(date) }),
    qc.fetchQuery({ queryKey: ['minimumSaleValue', date], queryFn: () => getMinimumSaleValue(date) }),
    qc.fetchQuery({ queryKey: ['closingStock', date], queryFn: () => getClosingStock(date) }),
  ]);

  const expensesText = buildExpensesText(date, expenses.items, refills);
  const sale = buildDayDetails({
    date,
    expenses: expensesText.total,
    cash: cash.amount,
    upi: summary.upiTotal,
    minimumSale: minimumSale ? minimumSale.totalMinimumSaleValue : null,
  });
  const momos = closing.items.filter((i) => i.category === 'momo_packet');
  const stock = closing.isSubmitted
    ? buildClosingSummary(date, momos.map((i) => ({ displayName: i.displayName, packets: i.packetsLeft, pieces: i.piecesLeft, wastage: i.wastagePieces })))
    : 'Closing stock: not recorded yet';

  return [sale, expensesText.text, stock].join('\n\n----------\n\n');
}
