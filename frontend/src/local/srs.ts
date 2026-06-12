import { type AnswerQuality } from '../types/api';

/**
 * SM-2 — the single implementation of the scheduling algorithm (the server
 * stores client-computed progress verbatim and runs no SRS math).
 * Three-grade scale: 0 (wrong) / 3 (good) / 5 (easy). Good is a neutral pass
 * (easiness factor unchanged); only wrong and easy move the EF.
 *
 * srs.test.ts is the frozen reference spec — a change that fails the fixture
 * changes every user's schedule, so only do it deliberately and regenerate.
 */

export const WRONG = 0;
export const GOOD = 3;
export const EASY = 5;
const EASY_INTERVAL_BONUS = 1.3;

export interface SrsProgress {
  question_id: string;
  repetitions: number;
  easiness_factor: number;
  interval_days: number;
  next_review_at: string | null; // local calendar day 'YYYY-MM-DD'
  last_reviewed_at: string | null; // ISO timestamp (UTC)
  last_quality: number | null;
}

export function makeProgress(questionId: string): SrsProgress {
  return {
    question_id: questionId,
    repetitions: 0,
    easiness_factor: 2.5,
    interval_days: 0,
    next_review_at: null,
    last_reviewed_at: null,
    last_quality: null,
  };
}

/** Python-style round-half-even, so intervals match the backend exactly. */
function pyRound(x: number): number {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

/** Local-calendar 'YYYY-MM-DD' — same convention as store/dailyProgress.ts. */
export function localDay(d: Date = new Date()): string {
  return d.toLocaleDateString('sv-SE');
}

function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return localDay(date);
}

export function applySm2(
  progress: SrsProgress,
  quality: AnswerQuality,
  reviewedAt: Date = new Date(),
): SrsProgress {
  let interval: number;
  if (quality === WRONG) {
    progress.repetitions = 0;
    interval = 1;
    progress.easiness_factor = Math.max(1.3, progress.easiness_factor - 0.2);
  } else {
    if (progress.repetitions === 0) interval = 1;
    else if (progress.repetitions === 1) interval = 6;
    else interval = pyRound(progress.interval_days * progress.easiness_factor);
    progress.repetitions += 1;
    if (quality === EASY) {
      interval = pyRound(interval * EASY_INTERVAL_BONUS);
      progress.easiness_factor = progress.easiness_factor + 0.15;
    }
    // GOOD: easiness factor unchanged (neutral pass)
  }

  progress.interval_days = interval;
  progress.next_review_at = addDays(localDay(reviewedAt), interval);
  progress.last_reviewed_at = reviewedAt.toISOString();
  progress.last_quality = quality;
  return progress;
}
