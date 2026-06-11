import { type UserStats, type WeakCategory } from '../types/api';
import { query } from './db';
import { localDay } from './srs';

const WEAK_CATEGORY_MIN_ANSWERS = 5;
const WEAK_CATEGORY_LIMIT = 5;

/**
 * Local stats — port of backend/app/services/stats.py over the local tables.
 * Streak/weak-category aggregation runs on the full local answer-event log
 * (which is append-only and unioned with the server on sync).
 */

async function streakDays(): Promise<number> {
  const rows = await query<{ d: string }>(
    `SELECT DISTINCT date(answered_at, 'localtime') AS d FROM answer_events ORDER BY d DESC`,
  );
  if (rows.length === 0) return 0;

  const days = new Set(rows.map((r) => r.d));
  const today = localDay();
  const yesterday = localDay(new Date(Date.now() - 24 * 60 * 60 * 1000));
  // Streak is still alive if the user studied today or yesterday
  let cursor = days.has(today) ? today : yesterday;
  if (!days.has(cursor)) return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    const [y, m, d] = cursor.split('-').map(Number);
    cursor = localDay(new Date(y, m - 1, d - 1));
  }
  return streak;
}

export async function getLocalStats(): Promise<UserStats> {
  const [dueRow] = await query<{ n: number }>(
    'SELECT COUNT(*) AS n FROM progress WHERE next_review_at <= ?',
    [localDay()],
  );
  const [studiedRow] = await query<{ n: number }>('SELECT COUNT(*) AS n FROM progress');
  const [totalRow] = await query<{ n: number }>(
    'SELECT COUNT(*) AS n FROM questions WHERE is_active = 1',
  );
  const weak = await query<WeakCategory & { cnt: number }>(
    `SELECT q.category_id AS category_id, c.name AS category_name,
            AVG(e.quality) AS avg_quality, COUNT(*) AS cnt
     FROM answer_events e
     JOIN questions q ON q.id = e.question_id
     JOIN categories c ON c.id = q.category_id
     GROUP BY q.category_id, c.name
     HAVING COUNT(*) >= ${WEAK_CATEGORY_MIN_ANSWERS}
     ORDER BY avg_quality ASC
     LIMIT ${WEAK_CATEGORY_LIMIT}`,
  );

  return {
    due_today: dueRow?.n ?? 0,
    total_studied: studiedRow?.n ?? 0,
    total_questions: totalRow?.n ?? 0,
    streak_days: await streakDays(),
    weak_categories: weak.map((w) => ({
      category_id: w.category_id,
      category_name: w.category_name,
      avg_quality: Math.round(w.avg_quality * 100) / 100,
    })),
  };
}
