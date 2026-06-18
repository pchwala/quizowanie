import { useQuery } from '@tanstack/react-query';
import { listUserQuestions } from '../local/userQuestions';

export const USER_QUESTIONS_KEY = ['userQuestions'];

export function useUserQuestions() {
  return useQuery({
    queryKey: USER_QUESTIONS_KEY,
    queryFn: listUserQuestions,
  });
}
