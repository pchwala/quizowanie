import { Network } from '@capacitor/network';
import client from '../api/client';
import { auth } from '../firebase';
import { getDb, persistWebStore, query, run, setMeta } from '../local/db';
import { type AnswerQuality, type StudyMode } from '../types/api';

/**
 * Sync engine — pushes the local answer-event log to `POST /study/sync` and
 * reconciles the returned canonical progress with last-write-wins per
 * question. Non-destructive in both directions: events are unioned by UUID,
 * progress rows resolve by the newer `last_reviewed_at`.
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

interface ServerProgressRow {
  question_id: string;
  repetitions: number;
  easiness_factor: number;
  interval_days: number;
  next_review_at: string | null;
  last_reviewed_at: string | null;
  last_quality: number | null;
}

interface SyncResponse {
  synced: number;
  progress: ServerProgressRow[];
}

export const SYNC_DONE_EVENT = 'quizowanie:sync-done';

let syncing = false;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Run one full push+pull cycle. Returns the number of newly synced answers,
 * or null when sync is not possible right now (offline / no identity / busy).
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

    // Anonymous users have a single device — nothing to pull, so skip the
    // round-trip when there is also nothing to push (avoids an API call on
    // every tab refocus). Registered users always pull (multi-device merge).
    if (events.length === 0 && auth.currentUser.isAnonymous) return 0;

    const { data } = await client.post<SyncResponse>('/study/sync', { events });

    // Mark pushed events as synced (chunked to keep placeholder lists sane).
    for (const part of chunk(events, 500)) {
      await run(
        `UPDATE answer_events SET synced = 1 WHERE event_id IN (${part.map(() => '?').join(',')})`,
        part.map((e) => e.event_id),
      );
    }

    // Pull-reconcile: LWW per question by last_reviewed_at.
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

    await setMeta('last_sync_at', new Date().toISOString());
    await persistWebStore();

    if (data.synced > 0) {
      window.dispatchEvent(new CustomEvent(SYNC_DONE_EVENT, { detail: { synced: data.synced } }));
    }
    return data.synced;
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
