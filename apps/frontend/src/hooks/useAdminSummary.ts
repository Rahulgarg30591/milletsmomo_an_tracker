import { useQuery } from '@tanstack/react-query';
import { getAdminSummary } from '../api/adminApi';

export function useAdminSummary(date: string) {
  return useQuery({
    queryKey: ['adminSummary', date],
    queryFn: () => getAdminSummary(date),
    enabled: !!date,
  });
}
