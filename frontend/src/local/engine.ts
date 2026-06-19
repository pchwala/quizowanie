import { type AnswerQuality, type QuestionDetail, type QuestionSource, type StudyMode, type StudySession } from '../types/api';
import { persistWebStore, query, run } from './db';
import { getNextLocalQuestion } from './nextQuestion';
import { applySm2, makeProgress, type SrsProgress } from './srs';

/**
 * Local study-session orchestration — replaces the /study/sessions/* API for
 * the on-device store. Sessions are in-memory only: the durable record is the
 * per-answer `answer_events` log (which carries the mode) plus the `progress`
 * upsert; that is everything the server sync needs.
 */

export function startLocalSession(
  categoryIds: string[] | null,
  mode: StudyMode,
  sources: QuestionSource[] | null = null,
): StudySession {
  return {
    id: crypto.randomUUID(),
    category_ids: categoryIds,
    sources,
    mode,
    started_at: new Date().toISOString(),
    questions_answered: 0,
  };
}

export async function getNextForSession(session: StudySession): Promise<QuestionDetail | null> {
  return getNextLocalQuestion(session.mode, session.category_ids, session.sources);
}

export async function submitLocalAnswer(
  session: StudySession,
  questionId: string,
  quality: AnswerQuality,
): Promise<void> {
  const rows = await query<SrsProgress>(
    'SELECT * FROM progress WHERE question_id = ?',
    [questionId],
  );
  const progress = rows[0] ?? makeProgress(questionId);
  applySm2(progress, quality);

  await run(
    `INSERT INTO progress
       (question_id, repetitions, easiness_factor, interval_days, next_review_at, last_reviewed_at, last_quality)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(question_id) DO UPDATE SET
       repetitions = excluded.repetitions,
       easiness_factor = excluded.easiness_factor,
       interval_days = excluded.interval_days,
       next_review_at = excluded.next_review_at,
       last_reviewed_at = excluded.last_reviewed_at,
       last_quality = excluded.last_quality`,
    [
      progress.question_id,
      progress.repetitions,
      progress.easiness_factor,
      progress.interval_days,
      progress.next_review_at,
      progress.last_reviewed_at,
      progress.last_quality,
    ],
  );
  await run(
    `INSERT INTO answer_events (event_id, question_id, quality, answered_at, mode, synced)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [crypto.randomUUID(), questionId, quality, new Date().toISOString(), session.mode],
  );
  session.questions_answered += 1;
  await persistWebStore();
}
