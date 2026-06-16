import { client } from './client';

export async function getOrders(date: string) {
  const res = await client.get('/orders', { params: { date } });
  return res.data;
}

export async function createOrder(data: {
  orderDate: string;
  orderType: 'dine' | 'pack';
  paymentMethod: 'cash' | 'upi' | 'pending';
  items: { menuItemId: number; quantity: number; isHalf: boolean }[];
}) {
  const res = await client.post('/orders', data);
  return res.data;
}

export async function completeOrder(id: number, paymentMethod?: 'cash' | 'upi') {
  const res = await client.patch(`/orders/${id}/complete`, { paymentMethod });
  return res.data;
}

export async function deleteOrder(id: number) {
  const res = await client.delete(`/orders/${id}`);
  return res.data;
}
