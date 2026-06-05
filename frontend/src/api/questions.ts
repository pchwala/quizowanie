import client from './client';
import { type Question, type QuestionSource } from '../types/api';

export interface QuestionFilters {
  category_id?: string;
  source?: QuestionSource;
  difficulty_min?: number;
  difficulty_max?: number;
  limit?: number;
  offset?: number;
}

export const getQuestions = (params?: QuestionFilters): Promise<Question[]> =>
  client.get('/questions', { params }).then((r) => r.data);

export const getQuestion = (id: string): Promise<Question> =>
  client.get(`/questions/${id}`).then((r) => r.data);
