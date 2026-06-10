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

export type QuestionSource = '1z10_archive' | 'milionerzy_archive' | 'pubquiz_archive' | 'opentdb';

export const SOURCE_LABELS: Record<QuestionSource, string> = {
  '1z10_archive':      '1 z 10',
  milionerzy_archive:  'Milionerzy',
  pubquiz_archive:     'PubQuiz',
  opentdb:             'OpenTDB',
};

export type QuestionType = 'multiple' | 'boolean' | 'question';

// Used by the browse page — no answer exposed
export interface BrowseQuestion {
  id: string;
  type: QuestionType;
  text: string;
  source: QuestionSource;
  difficulty: number | null;
  category_id: string;
  options: string[] | null;
}

// Returned by GET /questions/:id — includes answer (reveal after submission)
export interface QuestionDetail extends BrowseQuestion {
  answer: string;
  payload: Record<string, unknown>;
  explanation: string | null;
  mnemonic: string | null;
}


export type StudyMode = 'new' | 'review' | 'mixed';

export interface StudySession {
  id: string;
  category_ids: string[] | null;
  mode: StudyMode;
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

export type AnswerQuality = 0 | 3 | 5;

export interface UserPreferences {
  show_options: boolean;
  daily_limit?: number;
}
