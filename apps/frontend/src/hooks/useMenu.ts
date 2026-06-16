import { useQuery } from '@tanstack/react-query';
import { getMenu } from '../api/menuApi';

export function useMenu() {
  return useQuery({
    queryKey: ['menu'],
    queryFn: getMenu,
    staleTime: 1000 * 60 * 60,
  });
}
