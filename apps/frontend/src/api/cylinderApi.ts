import { client } from './client';
import type { CylinderRefill, CylinderRefillInput, CylinderMonthReport } from '../types';

export async function getCylinderRefills(date: string): Promise<CylinderRefill[]> {
  const res = await client.get<{ date: string; refills: CylinderRefill[] }>('/cylinders', { params: { date } });
  return res.data.refills;
}

export async function getCylinderSources(): Promise<string[]> {
  const res = await client.get<{ sources: string[] }>('/cylinders/sources');
  return res.data.sources;
}

export async function addCylinderRefill(data: CylinderRefillInput & { refillDate: string }): Promise<CylinderRefill> {
  const res = await client.post<CylinderRefill>('/cylinders', data);
  return res.data;
}

export async function updateCylinderRefill(id: number, data: CylinderRefillInput): Promise<CylinderRefill> {
  const res = await client.put<CylinderRefill>(`/cylinders/${id}`, data);
  return res.data;
}

export async function deleteCylinderRefill(id: number): Promise<CylinderRefill> {
  const res = await client.delete<CylinderRefill>(`/cylinders/${id}`);
  return res.data;
}

export async function getCylinderMonthReport(month: string): Promise<CylinderMonthReport> {
  const res = await client.get<CylinderMonthReport>('/admin/cylinders', { params: { month } });
  return res.data;
}
