import { useQuery } from '@tanstack/react-query';
import { getDailyActivity } from '../local/stats';
import { type Timeline } from '../types/api';

export function useDailyActivity(timeline: Timeline) {
  return useQuery({
    queryKey: ['dailyActivity', timeline],
    queryFn: () => getDailyActivity(timeline),
  });
}
