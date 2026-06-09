import client from './client';
import { type BrowseQuestion, type QuestionDetail, type QuestionSource, type QuestionType } from '../types/api';

export interface QuestionFilters {
  category_id?: string;
  source?: QuestionSource;
  difficulty_min?: number;
  difficulty_max?: number;
  limit?: number;
  offset?: number;
}

export interface BrowseFilters extends QuestionFilters {
  type?: QuestionType;
}

export interface BrowseQuestionsPage {
  items: QuestionDetail[];
  total: number;
}

export const getQuestions = (params?: QuestionFilters): Promise<BrowseQuestion[]> =>
  client.get('/questions', { params }).then((r) => r.data);

export const getQuestion = (id: string): Promise<QuestionDetail> =>
  client.get(`/questions/${id}`).then((r) => r.data);

export const getBrowseQuestions = (params?: BrowseFilters): Promise<BrowseQuestionsPage> =>
  client.get('/browse/questions', { params }).then((r) => r.data);
