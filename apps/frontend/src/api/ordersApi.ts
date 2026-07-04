import { client } from './client';

export async function getOrders(date: string) {
  const res = await client.get('/orders', { params: { date } });
  return res.data;
}

export async function createOrder(data: {
  orderDate: string;
  orderType: 'dine' | 'pack';
  paymentMethod: 'cash' | 'upi' | 'split' | 'pending';
  cashAmount?: number;
  upiAmount?: number;
  items: { menuItemId: number; quantity: number; isHalf: boolean }[];
}) {
  const res = await client.post('/orders', data);
  return res.data;
}

export async function completeOrder(id: number, paymentMethod?: 'cash' | 'upi' | 'split', cashAmount?: number, upiAmount?: number) {
  const res = await client.patch(`/orders/${id}/complete`, { paymentMethod, cashAmount, upiAmount });
  return res.data;
}

export async function deleteOrder(id: number) {
  const res = await client.delete(`/orders/${id}`);
  return res.data;
}

export async function updateOrder(id: number, data: {
  orderType: 'dine' | 'pack';
  paymentMethod: 'cash' | 'upi' | 'split' | 'pending';
  cashAmount?: number;
  upiAmount?: number;
  items: { menuItemId: number; quantity: number; isHalf: boolean }[];
}) {
  const res = await client.put(`/orders/${id}`, data);
  return res.data;
}
