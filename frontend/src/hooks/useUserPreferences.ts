import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type UserPreferences } from '../types/api';
import { DEFAULT_PREFERENCES, getLocalPreferences, setLocalPreferences } from '../local/identity';

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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  return { preferences, updatePreferences };
}
