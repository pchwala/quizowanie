import { type FlagReason } from '../types/api';
import { syncNow } from '../sync/syncEngine';
import { persistWebStore, run } from './db';

/**
 * Question reports. A flag is a write-only, offline-queued event mirroring
 * `answer_events`: inserted locally with `synced = 0`, pushed to the shared
 * moderation queue on the next `/sync`, deduped server-side by `client_id`.
 * The device never needs its flags back, so there is no pull side.
 */
export async function reportQuestion(
  questionId: string,
  reason: FlagReason,
  detail?: string,
): Promise<void> {
  await run(
    `INSERT INTO question_flags (client_id, question_id, reason, detail, created_at, synced)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [crypto.randomUUID(), questionId, reason, detail?.trim() || null, new Date().toISOString()],
  );
  await persistWebStore();
  void syncNow();
}
