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
