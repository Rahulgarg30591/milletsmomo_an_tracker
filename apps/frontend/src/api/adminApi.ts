import { client } from './client';
import type { AdminSummary } from '../types';

export async function getAdminSummary(startDate: string, endDate?: string): Promise<AdminSummary> {
  const params: Record<string, string> = { date: startDate };
  if (endDate && endDate !== startDate) {
    params.endDate = endDate;
  }
  const res = await client.get<AdminSummary>('/admin/summary', { params });
  return res.data;
}