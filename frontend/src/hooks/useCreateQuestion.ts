import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type NewQuestionInput } from '../types/api';
import { createUserQuestion } from '../local/userQuestions';
import { USER_QUESTIONS_KEY } from './useUserQuestions';

export function useCreateQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: NewQuestionInput) => createUserQuestion(input),
    onSuccess: () => {
      // createUserQuestion already fired syncNow(); refresh the views that
      // surface the new question.
      queryClient.invalidateQueries({ queryKey: USER_QUESTIONS_KEY });
      queryClient.invalidateQueries({ queryKey: ['browse/questions'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}
