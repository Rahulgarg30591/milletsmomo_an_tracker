import { client } from './client';

export async function getAdminSummary(date: string) {
  const res = await client.get('/admin/summary', { params: { date } });
  return res.data;
}
