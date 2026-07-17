import { useEffect } from 'react';

export function useForegroundRefetch(refetch: () => void) {
  useEffect(() => {
    const handler = () => {
      if (!document.hidden) refetch();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [refetch]);
}
