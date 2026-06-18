import { type DailyActivity, type Timeline, type UserStats, type WeakCategory } from '../types/api';
import { query } from './db';
import { localDay } from './srs';

const TIMELINE_DAYS: Record<Exclude<Timeline, 'all'>, number> = {
  week: 7,
  month: 30,
  '3months': 90,
  year: 365,
};

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

/**
 * Per-day activity for the stats chart, zero-filled across the selected range.
 * - learned  = distinct questions whose FIRST-EVER answer fell on that day
 *              (same definition as the daily-goal counter, kept consistent).
 * - reviewed = all answers that day that were NOT a question's first answer.
 * Runs over the full local answer_events log (append-only, unioned on sync).
 */
export async function getDailyActivity(timeline: Timeline): Promise<DailyActivity[]> {
  let startDay: string;
  if (timeline === 'all') {
    const [minRow] = await query<{ d: string | null }>(
      `SELECT date(MIN(answered_at), 'localtime') AS d FROM answer_events`,
    );
    if (!minRow?.d) return [];
    startDay = minRow.d;
  } else {
    const days = TIMELINE_DAYS[timeline];
    startDay = localDay(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
  }

  // learned[day] = count of questions whose first-ever answer is on that day
  const learnedRows = await query<{ d: string; n: number }>(
    `SELECT date(first_at, 'localtime') AS d, COUNT(*) AS n FROM (
       SELECT question_id, MIN(answered_at) AS first_at
       FROM answer_events GROUP BY question_id
     )
     WHERE date(first_at, 'localtime') >= ?
     GROUP BY d`,
    [startDay],
  );
  // total[day] = all answers that day
  const totalRows = await query<{ d: string; n: number }>(
    `SELECT date(answered_at, 'localtime') AS d, COUNT(*) AS n
     FROM answer_events
     WHERE date(answered_at, 'localtime') >= ?
     GROUP BY d`,
    [startDay],
  );

  const learnedBy = new Map(learnedRows.map((r) => [r.d, r.n]));
  const totalBy = new Map(totalRows.map((r) => [r.d, r.n]));

  const result: DailyActivity[] = [];
  const today = localDay();
  const [sy, sm, sd] = startDay.split('-').map(Number);
  for (let cursor = startDay, t = new Date(sy, sm - 1, sd); cursor <= today; ) {
    const learned = learnedBy.get(cursor) ?? 0;
    const total = totalBy.get(cursor) ?? 0;
    result.push({ day: cursor, learned, reviewed: Math.max(0, total - learned) });
    t.setDate(t.getDate() + 1);
    cursor = localDay(t);
  }
  return result;
}

/**
 * Daily-goal counter: distinct questions whose FIRST-EVER answer happened
 * today (local time). Derived from the synced answer_events log, so it
 * survives reinstalls and counts study done on other devices.
 */
export async function getNewLearnedToday(): Promise<number> {
  const [row] = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM (
       SELECT question_id, MIN(answered_at) AS first_at
       FROM answer_events
       GROUP BY question_id
       HAVING date(first_at, 'localtime') = date('now', 'localtime')
     )`,
  );
  return row?.n ?? 0;
}
