import { client } from './client';
import type { SupplyItem, SupplyOrder, CreateSupplyOrderRequest, SupplyOrderLog } from '../types';

export async function getSupplyItems(): Promise<SupplyItem[]> {
  const res = await client.get<SupplyItem[]>('/admin/supply/items');
  return res.data;
}

export async function getSupplyOrder(date: string): Promise<SupplyOrder> {
  const res = await client.get<SupplyOrder>('/admin/supply/order', { params: { date } });
  return res.data;
}

export async function listSupplyOrders(startDate: string, endDate: string): Promise<SupplyOrder[]> {
  const res = await client.get<SupplyOrder[]>('/admin/supply/orders', { params: { date: startDate, endDate } });
  return res.data;
}

export async function getSupplyOrderLogs(date: string): Promise<SupplyOrderLog[]> {
  const res = await client.get<SupplyOrderLog[]>('/admin/supply/logs', { params: { date } });
  return res.data;
}

export async function saveSupplyOrder(data: CreateSupplyOrderRequest): Promise<SupplyOrder> {
  const res = await client.put<SupplyOrder>('/admin/supply/order', data);
  return res.data;
}