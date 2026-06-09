import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type UserPreferences } from '../types/api';
import { getUserPreferences, updateUserPreferences } from '../api/users';

const QUERY_KEY = ['userPreferences'];
const DEFAULT_PREFERENCES: UserPreferences = { show_options: true, daily_limit: 15 };

export function useUserPreferences() {
  const queryClient = useQueryClient();

  const { data: preferences = DEFAULT_PREFERENCES } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getUserPreferences,
  });

  const { mutate: updatePreferences } = useMutation({
    mutationFn: updateUserPreferences,
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
