import { client } from './client';
import type { StaffLeave, StaffLeaveInput, LeaveMonthReport, StaffTakeaway, StaffTakeawayInput, TakeawayMonthReport } from '../types';

export async function getStaffNames(): Promise<string[]> {
  const res = await client.get<{ names: string[] }>('/staff/names');
  return res.data.names;
}

export async function getLeaveMonth(month: string): Promise<LeaveMonthReport> {
  const res = await client.get<LeaveMonthReport>('/admin/leaves', { params: { month } });
  return res.data;
}

export async function addLeave(data: StaffLeaveInput): Promise<StaffLeave> {
  const res = await client.post<StaffLeave>('/admin/leaves', data);
  return res.data;
}

export async function updateLeave(id: number, data: StaffLeaveInput): Promise<StaffLeave> {
  const res = await client.put<StaffLeave>(`/admin/leaves/${id}`, data);
  return res.data;
}

export async function deleteLeave(id: number): Promise<StaffLeave> {
  const res = await client.delete<StaffLeave>(`/admin/leaves/${id}`);
  return res.data;
}

export async function getTakeawayMonth(month: string): Promise<TakeawayMonthReport> {
  const res = await client.get<TakeawayMonthReport>('/admin/takeaways', { params: { month } });
  return res.data;
}

export async function addTakeaway(data: StaffTakeawayInput): Promise<StaffTakeaway> {
  const res = await client.post<StaffTakeaway>('/admin/takeaways', data);
  return res.data;
}

export async function updateTakeaway(id: number, data: StaffTakeawayInput): Promise<StaffTakeaway> {
  const res = await client.put<StaffTakeaway>(`/admin/takeaways/${id}`, data);
  return res.data;
}

export async function deleteTakeaway(id: number): Promise<StaffTakeaway> {
  const res = await client.delete<StaffTakeaway>(`/admin/takeaways/${id}`);
  return res.data;
}

/** What staff took on a day, for stock screens. Any signed-in user. */
export async function getTakeawayItems(date: string): Promise<{ menuItemId: number; quantity: number }[]> {
  const res = await client.get<{ date: string; items: { menuItemId: number; quantity: number }[] }>('/staff/takeaway-items', { params: { date } });
  return res.data.items;
}
