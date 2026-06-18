export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
}

export type QuestionSource =
  | '1z10_archive'
  | 'milionerzy_archive'
  | 'pubquiz_archive'
  | 'opentdb'
  | 'user_submission';

export const SOURCE_LABELS: Record<QuestionSource, string> = {
  '1z10_archive':      '1 z 10',
  milionerzy_archive:  'Milionerzy',
  pubquiz_archive:     'PubQuiz',
  opentdb:             'OpenTDB',
  user_submission:     'Użytkownik',
};

export type QuestionType = 'multiple' | 'boolean' | 'question';

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

// Input for the add-question form (open format only in v1).
export interface NewQuestionInput {
  text: string;
  answer: string;
  extraAccepted?: string[];
  explanation?: string;
  mnemonic?: string;
  isPublic: boolean;
  categoryId: string; // real category for both private and public submissions
}

// A question authored by the current user, as stored/displayed locally.
export interface AuthoredQuestion {
  id: string;
  type: QuestionType;
  text: string;
  answer: string;
  category_id: string;
  is_public: boolean;
  verification_status: VerificationStatus | null;
}

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

// Full question row from the local store — includes answer (revealed after flip)
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

// Activity chart: amount learned (first-ever answer) vs reviewed per calendar day.
export type Timeline = 'week' | 'month' | '3months' | 'year' | 'all';

export interface DailyActivity {
  day: string; // YYYY-MM-DD (local)
  learned: number;
  reviewed: number;
}

export type AnswerQuality = 0 | 3 | 5;

export interface UserPreferences {
  show_options: boolean;
  daily_limit?: number;
}
