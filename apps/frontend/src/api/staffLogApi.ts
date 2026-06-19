import { client } from './client';
import type { StaffLogsResponse } from '../types';

export async function getStaffLogs(date?: string, type?: string): Promise<StaffLogsResponse> {
  const res = await client.get<StaffLogsResponse>('/admin/staff-logs', { params: { date, type } });
  return res.data;
}
