import { client } from './client';

export interface PaymentSettlementSummary {
  orderDate: string;
  expectedCash: number;
  expectedUpi: number;
  totalOrders: number;
  isSettled: boolean;
  settlement?: {
    id: number;
    orderDate: string;
    expectedCash: number;
    expectedUpi: number;
    actualCash: number;
    actualUpi: number;
    cashConflict: boolean;
    upiConflict: boolean;
    notes: string | null;
  };
}

export interface PaymentSettlement {
  id: number;
  orderDate: string;
  expectedCash: number;
  expectedUpi: number;
  actualCash: number;
  actualUpi: number;
  cashConflict: boolean;
  upiConflict: boolean;
  notes: string | null;
}

export async function getPaymentSettlement(date: string): Promise<PaymentSettlementSummary> {
  const res = await client.get<PaymentSettlementSummary>('/admin/settlement', { params: { date } });
  return res.data;
}

export async function submitPaymentSettlement(data: {
  orderDate: string;
  actualCash: number;
  actualUpi: number;
  notes: string | null;
}): Promise<PaymentSettlement> {
  const res = await client.post<PaymentSettlement>('/admin/settlement', data);
  return res.data;
}

export async function listPaymentSettlements(startDate: string, endDate: string): Promise<PaymentSettlement[]> {
  const res = await client.get<PaymentSettlement[]>('/admin/settlements', { params: { startDate, endDate } });
  return res.data;
}
