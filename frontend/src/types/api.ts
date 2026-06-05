export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
}

export type QuestionSource = '1z10_archive' | 'milionerzy_archive' | 'pubquiz_archive';

export interface Question {
  id: string;
  text: string;
  answer: string;
  explanation: string | null;
  mnemonic: string | null;
  source: QuestionSource;
  difficulty: number | null;
  category_id: string;
}

export interface StudySession {
  id: string;
  category_id: string | null;
  started_at: string;
  questions_answered: number;
}

export interface WeakCategory {
  category_id: string;
  category_name: string;
  avg_quality: number;
}

export interface UserStats {
  due_today: number;
  total_studied: number;
  streak_days: number;
  total_questions: number;
  weak_categories: WeakCategory[];
}

export type AnswerQuality = 0 | 3 | 4 | 5;
