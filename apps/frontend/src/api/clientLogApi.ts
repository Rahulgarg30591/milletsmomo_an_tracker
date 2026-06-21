import { client } from './client';

export interface ClientLogEntry {
  id: number;
  userId: number | null;
  userRole: string | null;
  type: string;
  page: string | null;
  details: string | null;
  metadata: Record<string, any> | null;
  deviceInfo: string | null;
  durationMs: number | null;
  createdAt: string;
}

export async function getClientLogs(date: string, type?: string): Promise<{ logs: ClientLogEntry[] }> {
  const params: Record<string, string> = { date };
  if (type) params.type = type;
  const res = await client.get<{ logs: ClientLogEntry[] }>('/admin/client-logs', { params });
  return res.data;
}