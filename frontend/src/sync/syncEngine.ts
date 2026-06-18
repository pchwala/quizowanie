import { Network } from '@capacitor/network';
import client from '../api/client';
import { auth } from '../firebase';
import { getDb, getMeta, persistWebStore, query, run, setMeta } from '../local/db';
import { type AnswerQuality, type StudyMode, type UserPreferences } from '../types/api';

/**
 * Sync engine — mirrors the device's user data with `POST /sync`. The client
 * is the study engine; the server only stores.
 *
 * Push: unsynced answer events (unioned server-side by UUID), the ENTIRE
 * local progress table (server upserts per question, LWW by
 * `last_reviewed_at`), and preferences (null = never set locally).
 * Pull: events this device is missing (`server_seq > cursor` — rebuilds full
 * history and stats on a fresh device), all server progress rows (applied
 * with the same LWW rule), and preferences.
 *
 * Requires a Firebase user (anonymous or linked) + connectivity; both attach
 * lazily, so study never waits on this module.
 */

interface LocalAnswerEvent {
  event_id: string;
  question_id: string;
  quality: AnswerQuality;
  answered_at: string;
  mode: StudyMode;
}

interface LocalProgressRow {
  question_id: string;
  repetitions: number;
  easiness_factor: number;
  interval_days: number;
  next_review_at: string | null;
  last_reviewed_at: string | null;
  last_quality: number | null;
}

// Authored question as stored locally (payload is a JSON string, is_public an int).
interface LocalAuthoredQuestionRow {
  id: string;
  type: string;
  text: string;
  answer: string;
  payload: string;
  explanation: string | null;
  mnemonic: string | null;
  is_public: number;
  category_id: string;
}

// Authored question as returned by the server (full row for restore/status).
interface RemoteAuthoredQuestion {
  id: string;
  type: string;
  text: string;
  answer: string;
  payload: Record<string, unknown>;
  explanation: string | null;
  mnemonic: string | null;
  source: string;
  category_id: string;
  is_public: boolean;
  verification_status: string;
}

interface SyncResponse {
  synced: number;
  events: LocalAnswerEvent[];
  progress: LocalProgressRow[];
  authored_questions: RemoteAuthoredQuestion[];
  preferences: UserPreferences | Record<string, never>;
  cursor: number;
}

export const SYNC_DONE_EVENT = 'quizowanie:sync-done';

let syncing = false;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Run one full push+pull cycle. Returns the number of answers exchanged
 * (pushed + pulled), or null when sync is not possible right now
 * (offline / no identity / busy).
 */
export async function syncNow(): Promise<number | null> {
  if (syncing) return null;
  if (!auth.currentUser) return null;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null;

  syncing = true;
  try {
    const events = await query<LocalAnswerEvent>(
      'SELECT event_id, question_id, quality, answered_at, mode FROM answer_events WHERE synced = 0 ORDER BY answered_at',
    );
    const authoredRows = await query<LocalAuthoredQuestionRow>(
      `SELECT id, type, text, answer, payload, explanation, mnemonic, is_public, category_id
         FROM questions WHERE is_user_owned = 1 AND synced = 0`,
    );

    // Anonymous users have a single device — nothing to pull, so skip the
    // round-trip when there is also nothing to push (avoids an API call on
    // every tab refocus). Registered users always pull (multi-device mirror).
    if (events.length === 0 && authoredRows.length === 0 && auth.currentUser.isAnonymous) return 0;

    const progress = await query<LocalProgressRow>(
      'SELECT question_id, repetitions, easiness_factor, interval_days, next_review_at, last_reviewed_at, last_quality FROM progress',
    );
    // Raw meta read, NOT getLocalPreferences(): null must mean "never set
    // locally" so a fresh device cannot clobber server prefs with defaults.
    const rawPrefs = await getMeta('preferences');
    const cursor = Number((await getMeta('sync_cursor')) ?? '0');

    const authored_questions = authoredRows.map((q) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      answer: q.answer,
      payload: JSON.parse(q.payload) as Record<string, unknown>,
      explanation: q.explanation,
      mnemonic: q.mnemonic,
      is_public: q.is_public === 1,
      category_id: q.category_id,
    }));

    const { data } = await client.post<SyncResponse>('/sync', {
      events,
      progress,
      authored_questions,
      preferences: rawPrefs ? JSON.parse(rawPrefs) : null,
      cursor,
    });

    // Mark pushed events as synced (chunked to keep placeholder lists sane).
    for (const part of chunk(events, 500)) {
      await run(
        `UPDATE answer_events SET synced = 1 WHERE event_id IN (${part.map(() => '?').join(',')})`,
        part.map((e) => e.event_id),
      );
    }
    // Mark pushed authored questions as synced.
    for (const part of chunk(authoredRows, 500)) {
      await run(
        `UPDATE questions SET synced = 1 WHERE id IN (${part.map(() => '?').join(',')})`,
        part.map((q) => q.id),
      );
    }

    // Insert pulled events (other devices' history) — this is what makes
    // streak/stats correct after a reinstall or on a second device.
    // OR IGNORE keeps duplicates a no-op; synced=1 prevents re-push loops.
    if (data.events.length) {
      const db = await getDb();
      for (const part of chunk(data.events, 500)) {
        await db.executeSet([
          {
            statement: `INSERT OR IGNORE INTO answer_events
                (event_id, question_id, quality, answered_at, mode, synced)
              VALUES (?, ?, ?, ?, ?, 1)`,
            values: part.map((e) => [
              e.event_id, e.question_id, e.quality, e.answered_at, e.mode,
            ]),
          },
        ]);
      }
    }

    // Pull-reconcile progress: LWW per question by last_reviewed_at.
    const local = await query<{ question_id: string; last_reviewed_at: string | null }>(
      'SELECT question_id, last_reviewed_at FROM progress',
    );
    const localReviewedAt = new Map(local.map((r) => [r.question_id, r.last_reviewed_at]));

    const wins = data.progress.filter((p) => {
      const mine = localReviewedAt.get(p.question_id);
      if (mine === undefined) return true; // unknown locally → take server row
      if (!p.last_reviewed_at) return false;
      if (!mine) return true;
      return new Date(p.last_reviewed_at) > new Date(mine);
    });

    if (wins.length) {
      const db = await getDb();
      await db.executeSet([
        {
          statement: `INSERT INTO progress
              (question_id, repetitions, easiness_factor, interval_days, next_review_at, last_reviewed_at, last_quality)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(question_id) DO UPDATE SET
              repetitions = excluded.repetitions,
              easiness_factor = excluded.easiness_factor,
              interval_days = excluded.interval_days,
              next_review_at = excluded.next_review_at,
              last_reviewed_at = excluded.last_reviewed_at,
              last_quality = excluded.last_quality`,
          values: wins.map((p) => [
            p.question_id, p.repetitions, p.easiness_factor, p.interval_days,
            p.next_review_at, p.last_reviewed_at, p.last_quality,
          ]),
        },
      ]);
    }

    // Upsert authored questions (restores them on a fresh device and flows
    // back verification status changes). Always is_user_owned=1 + synced=1.
    if (data.authored_questions.length) {
      const db = await getDb();
      for (const part of chunk(data.authored_questions, 500)) {
        await db.executeSet([
          {
            statement: `INSERT INTO questions
                (id, type, text, answer, payload, explanation, mnemonic, source, difficulty,
                 category_id, is_active, bundle_version, is_user_owned, is_public, verification_status, synced)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 1, NULL, 1, ?, ?, 1)
              ON CONFLICT(id) DO UPDATE SET
                text = excluded.text, answer = excluded.answer, payload = excluded.payload,
                explanation = excluded.explanation, mnemonic = excluded.mnemonic,
                source = excluded.source, category_id = excluded.category_id,
                is_user_owned = 1, is_public = excluded.is_public,
                verification_status = excluded.verification_status, synced = 1`,
            values: part.map((q) => [
              q.id, q.type, q.text, q.answer, JSON.stringify(q.payload),
              q.explanation, q.mnemonic, q.source, q.category_id,
              q.is_public ? 1 : 0, q.verification_status,
            ]),
          },
        ]);
      }
    }

    // Restore preferences only when this device never set any.
    if (!rawPrefs && data.preferences && Object.keys(data.preferences).length > 0) {
      await setMeta('preferences', JSON.stringify(data.preferences));
    }

    // Advance the pull cursor only after the pulled events are stored.
    await setMeta('sync_cursor', String(data.cursor));
    await setMeta('last_sync_at', new Date().toISOString());
    await persistWebStore();

    const exchanged = data.synced + data.events.length;
    if (exchanged > 0) {
      window.dispatchEvent(new CustomEvent(SYNC_DONE_EVENT, { detail: { synced: exchanged } }));
    }
    return exchanged;
  } catch {
    return null; // offline / auth failure — retried on the next trigger
  } finally {
    syncing = false;
  }
}

let triggersInstalled = false;

/** Install passive sync triggers: reconnect + tab refocus. Idempotent. */
export function installSyncTriggers(): void {
  if (triggersInstalled) return;
  triggersInstalled = true;

  window.addEventListener('online', () => void syncNow());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void syncNow();
  });
  // Native connectivity events (also works on web)
  void Network.addListener('networkStatusChange', (status) => {
    if (status.connected) void syncNow();
  });
}
