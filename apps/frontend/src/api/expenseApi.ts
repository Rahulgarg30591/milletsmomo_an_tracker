import { client } from './client';
import type { DayExpenses, SaveExpensesRequest } from '../types';

export async function getDayExpenses(date: string): Promise<DayExpenses> {
  const res = await client.get<DayExpenses>('/expenses', { params: { date } });
  return res.data;
}

export async function saveDayExpenses(data: SaveExpensesRequest): Promise<DayExpenses> {
  const res = await client.put<DayExpenses>('/expenses', data);
  return res.data;
}
