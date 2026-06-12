import { useQuery } from '@tanstack/react-query';
import { getNewLearnedToday } from '../local/stats';

/**
 * "Poznane dziś" — derived from the local answer_events log (not a device
 * counter), so it stays correct after a restore or a sync from another
 * device. Invalidated per answer (useStudySession) and after sync (SyncToast).
 */
export function useNewLearnedToday(): number {
  const { data } = useQuery({ queryKey: ['newLearnedToday'], queryFn: getNewLearnedToday });
  return data ?? 0;
}
