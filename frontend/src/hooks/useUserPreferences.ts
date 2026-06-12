import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type UserPreferences } from '../types/api';
import { DEFAULT_PREFERENCES, getLocalPreferences, setLocalPreferences } from '../local/identity';
import { syncNow } from '../sync/syncEngine';

const QUERY_KEY = ['userPreferences'];

export function useUserPreferences() {
  const queryClient = useQueryClient();

  const { data: preferences = DEFAULT_PREFERENCES } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getLocalPreferences,
  });

  const { mutate: updatePreferences } = useMutation({
    mutationFn: async (prefs: UserPreferences) => {
      await setLocalPreferences(prefs);
      return prefs;
    },
    onMutate: async (newPrefs) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<UserPreferences>(QUERY_KEY);
      queryClient.setQueryData<UserPreferences>(QUERY_KEY, (old) => ({
        ...DEFAULT_PREFERENCES,
        ...old,
        ...newPrefs,
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY, context.previous);
      }
    },
    onSuccess: () => {
      // Push the just-written preferences to Neon now. Fire-and-forget:
      // registered users push immediately; a guest with no unsynced events
      // returns early in syncNow (stays local until they register); offline
      // is retried on the next passive trigger.
      void syncNow();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  return { preferences, updatePreferences };
}
