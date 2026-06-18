import { type AuthoredQuestion, type NewQuestionInput } from '../types/api';
import { syncNow } from '../sync/syncEngine';
import { persistWebStore, query, run } from './db';

/**
 * User-authored questions. They live in the same `questions` table as bundle
 * content (so study/browse/SRS work unchanged) and are distinguished by
 * `is_user_owned = 1`. The client generates the id so the author's local copy
 * and the shared server row share it — a later verified-public arrival via the
 * bundle upserts the same row (no duplicate). `synced = 0` queues the row for
 * the next `/sync` push.
 */

interface UserQuestionRow {
  id: string;
  type: AuthoredQuestion['type'];
  text: string;
  answer: string;
  category_id: string;
  is_public: number | null;
  verification_status: AuthoredQuestion['verification_status'];
}

/**
 * Create a private or public open-format question and queue it for sync. Both
 * visibilities keep the user's chosen real category — provenance is carried by
 * `source = user_submission`, so public submissions stay sortable by topic.
 */
export async function createUserQuestion(input: NewQuestionInput): Promise<string> {
  const categoryId = input.categoryId;
  if (!categoryId) {
    throw new Error('Wybierz kategorię.');
  }

  const accepted = [input.answer, ...(input.extraAccepted ?? [])]
    .map((a) => a.trim())
    .filter(Boolean);
  const payload = JSON.stringify({ accepted });
  const id = crypto.randomUUID();

  await run(
    `INSERT INTO questions
       (id, type, text, answer, payload, explanation, mnemonic, source, difficulty,
        category_id, is_active, bundle_version, is_user_owned, is_public, verification_status, synced)
     VALUES (?, 'question', ?, ?, ?, ?, ?, 'user_submission', NULL, ?, 1, NULL, 1, ?, ?, 0)`,
    [
      id,
      input.text.trim(),
      input.answer.trim(),
      payload,
      input.explanation?.trim() || null,
      input.mnemonic?.trim() || null,
      categoryId,
      input.isPublic ? 1 : 0,
      input.isPublic ? 'pending' : null,
    ],
  );
  await persistWebStore();
  void syncNow();
  return id;
}

/** All questions authored on this device (for the "Moje pytania" view). */
export async function listUserQuestions(): Promise<AuthoredQuestion[]> {
  const rows = await query<UserQuestionRow>(
    `SELECT id, type, text, answer, category_id, is_public, verification_status
       FROM questions WHERE is_user_owned = 1 ORDER BY rowid DESC`,
  );
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    text: r.text,
    answer: r.answer,
    category_id: r.category_id,
    is_public: r.is_public === 1,
    verification_status: r.verification_status,
  }));
}
