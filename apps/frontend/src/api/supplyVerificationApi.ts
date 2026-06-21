import { client } from './client';
import type { SupplyVerification, CreateSupplyVerificationRequest } from '../types';

export async function listSupplyVerifications(startDate: string, endDate: string): Promise<{ orderDate: string; isFullyVerified: boolean; conflictCount: number }[]> {
  const res = await client.get('/supply/verifications', { params: { startDate, endDate } });
  return res.data;
}

export async function getSupplyVerification(date: string): Promise<SupplyVerification> {
  const res = await client.get<SupplyVerification>('/supply/verification', { params: { date } });
  return res.data;
}

export async function submitSupplyVerification(data: CreateSupplyVerificationRequest): Promise<SupplyVerification> {
  const res = await client.post<SupplyVerification>('/supply/verification', data);
  return res.data;
}
