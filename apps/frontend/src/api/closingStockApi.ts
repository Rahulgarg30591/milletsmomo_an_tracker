import { client } from './client';
import type { ClosingStock, CreateClosingStockRequest } from '../types';

export async function getClosingStock(date: string): Promise<ClosingStock> {
  const res = await client.get<ClosingStock>('/supply/closing-stock', { params: { date } });
  return res.data;
}

export async function submitClosingStock(data: CreateClosingStockRequest): Promise<ClosingStock> {
  const res = await client.post<ClosingStock>('/supply/closing-stock', data);
  return res.data;
}

/** Cash counted at close. Admin responses also carry expected cash and the difference. */
export interface ClosingCash {
  orderDate: string;
  amount: number | null;
  recordedByName: string | null;
  recordedAt: string | null;
  cashSales?: number;
  expenses?: number;
  expectedCash?: number;
  difference?: number | null;
}

export async function getClosingCash(date: string): Promise<ClosingCash> {
  const res = await client.get<ClosingCash>('/supply/closing-cash', { params: { date } });
  return res.data;
}

export async function saveClosingCash(orderDate: string, amount: number): Promise<ClosingCash> {
  const res = await client.put<ClosingCash>('/supply/closing-cash', { orderDate, amount });
  return res.data;
}
