import { useQuery } from '@tanstack/react-query';
import { getUserStats } from '../api/users';

export function useUserStats() {
  return useQuery({
    queryKey: ['userStats'],
    queryFn: getUserStats,
  });
}
