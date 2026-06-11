import { useQuery } from '@tanstack/react-query';
import { getLocalCategories } from '../local/questions';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: getLocalCategories,
  });
}
