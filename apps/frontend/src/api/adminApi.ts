import { client } from './client';
import type { AdminSummary, Order } from '../types';

export async function getAdminSummary(startDate: string, endDate?: string): Promise<AdminSummary> {
  const params: Record<string, string> = { date: startDate };
  if (endDate && endDate !== startDate) {
    params.endDate = endDate;
  }
  const res = await client.get<AdminSummary>('/admin/summary', { params });
  return res.data;
}

export async function getAdminOrders(startDate: string, endDate?: string): Promise<{ date: string; orders: Order[] }> {
  const params: Record<string, string> = { date: startDate };
  if (endDate && endDate !== startDate) {
    params.endDate = endDate;
  }
  const res = await client.get<{ date: string; orders: Order[] }>('/admin/orders', { params });
  return res.data;
}
