import { useQuery } from '@tanstack/react-query';
import { getLocalStats } from '../local/stats';

export function useUserStats() {
  return useQuery({
    queryKey: ['userStats'],
    queryFn: getLocalStats,
  });
}
