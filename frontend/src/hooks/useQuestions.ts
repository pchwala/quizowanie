import { useQuery } from '@tanstack/react-query';
import { browseLocalQuestions, type LocalBrowseFilters } from '../local/questions';

export type BrowseFilters = LocalBrowseFilters;

export function useBrowseQuestions(filters: BrowseFilters) {
  return useQuery({
    queryKey: ['browse/questions', filters],
    queryFn: () => browseLocalQuestions(filters),
    placeholderData: (prev) => prev,
  });
}
