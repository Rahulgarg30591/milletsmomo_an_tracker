import { useQuery } from '@tanstack/react-query';
import { getTakeawayItems } from '../api/staffApi';

/**
 * Momos staff took on a day, shaped like an order so stock screens can count
 * them alongside the day's orders: they left stock without being sold.
 */
export function useTakeawayItems(date: string | undefined) {
  const { data = [] } = useQuery({
    queryKey: ['takeawayItems', date],
    queryFn: () => getTakeawayItems(date!),
    enabled: !!date,
  });
  return data;
}
