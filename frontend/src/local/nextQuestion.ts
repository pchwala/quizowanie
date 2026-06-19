import { type QuestionDetail, type QuestionSource, type StudyMode } from '../types/api';
import { query } from './db';
import { localDay } from './srs';
import { rowToDetail, type QuestionRow } from './questions';

/**
 * Next-question staging — port of `get_next_question` in
 * backend/app/routers/study.py:
 *   Stage 1 (review/mixed): due SRS rows, most overdue first.
 *   Stage 2 (new/mixed):    unseen questions, ordered by id (deterministic).
 *
 * The bundle only ever contains verified questions, so `is_active = 1` is the
 * full filter locally. Unlike the API split (/next withholds the answer, then
 * a detail fetch), we already hold the full row — return QuestionDetail directly.
 */
export async function getNextLocalQuestion(
  mode: StudyMode,
  categoryIds: string[] | null,
  sources: QuestionSource[] | null = null,
): Promise<QuestionDetail | null> {
  const catSql = categoryIds?.length
    ? `AND q.category_id IN (${categoryIds.map(() => '?').join(',')})`
    : '';
  const catParams = categoryIds?.length ? categoryIds : [];

  const srcSql = sources?.length
    ? `AND q.source IN (${sources.map(() => '?').join(',')})`
    : '';
  const srcParams = sources?.length ? sources : [];

  const filterSql = `${catSql} ${srcSql}`;
  const filterParams = [...catParams, ...srcParams];

  // Stage 1: due SRS questions
  if (mode === 'review' || mode === 'mixed') {
    const due = await query<QuestionRow>(
      `SELECT q.* FROM questions q
       JOIN progress p ON p.question_id = q.id
       WHERE q.is_active = 1 AND p.next_review_at <= ? ${filterSql}
       ORDER BY p.next_review_at ASC
       LIMIT 1`,
      [localDay(), ...filterParams],
    );
    if (due[0]) return rowToDetail(due[0]);
  }

  // Stage 2: unseen questions
  if (mode === 'new' || mode === 'mixed') {
    const unseen = await query<QuestionRow>(
      `SELECT q.* FROM questions q
       WHERE q.is_active = 1
         AND q.id NOT IN (SELECT question_id FROM progress) ${filterSql}
       ORDER BY q.id
       LIMIT 1`,
      filterParams,
    );
    if (unseen[0]) return rowToDetail(unseen[0]);
  }

  return null;
}
