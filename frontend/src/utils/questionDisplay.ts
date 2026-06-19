import type { QuestionType } from '../types/api';

export const TYPE_LABELS: Record<QuestionType, string> = {
  multiple: 'Wielokrotny wybór',
  boolean: 'Prawda / Fałsz',
  question: 'Otwarte',
};

export const DIFFICULTY_RANGES: Record<string, { min: number; max: number; label: string }> = {
  easy:   { min: 1, max: 3,  label: 'Łatwe' },
  medium: { min: 4, max: 6,  label: 'Średnie' },
  hard:   { min: 7, max: 10, label: 'Trudne' },
};

export function difficultyLabel(d: number | null): string {
  if (d === null) return '';
  if (d <= 3) return 'Łatwe';
  if (d <= 6) return 'Średnie';
  return 'Trudne';
}

export function difficultyColor(d: number | null): 'success' | 'warning' | 'error' | 'default' {
  if (d === null) return 'default';
  if (d <= 3) return 'success';
  if (d <= 6) return 'warning';
  return 'error';
}
