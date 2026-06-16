import { useQuery } from '@tanstack/react-query';
import { getOrders } from '../api/ordersApi';

export function useOrders(date: string) {
  return useQuery({
    queryKey: ['orders', date],
    queryFn: () => getOrders(date),
    enabled: !!date,
  });
}
