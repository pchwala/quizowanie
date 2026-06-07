import { useQuery } from '@tanstack/react-query';
import { getQuestions, getQuestion, getBrowseQuestions, type QuestionFilters, type BrowseFilters } from '../api/questions';

export function useQuestions(filters: QuestionFilters) {
  return useQuery({
    queryKey: ['questions', filters],
    queryFn: () => getQuestions(filters),
    placeholderData: (prev) => prev,
  });
}

export function useQuestionDetail(id: string | null) {
  return useQuery({
    queryKey: ['question', id],
    queryFn: () => getQuestion(id!),
    enabled: id !== null,
  });
}

export function useBrowseQuestions(filters: BrowseFilters) {
  return useQuery({
    queryKey: ['browse/questions', filters],
    queryFn: () => getBrowseQuestions(filters),
    placeholderData: (prev) => prev,
  });
}
