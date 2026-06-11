import client from '../api/client';
import { type Category, type QuestionSource, type QuestionType } from '../types/api';
import { getDb, getMeta, persistWebStore, query, run, setMeta } from './db';

/**
 * Question-pool bundle: fetched from the PUBLIC `GET /bundles/latest` on first
 * run (network required once), cached in local SQLite, refreshed in the
 * background on later launches. The app never needs the bundle endpoint again
 * while offline.
 */

interface BundleQuestion {
  id: string;
  type: QuestionType;
  text: string;
  answer: string;
  payload: Record<string, unknown>;
  explanation: string | null;
  mnemonic: string | null;
  source: QuestionSource;
  difficulty: number | null;
  category_id: string;
}

interface BundleResponse {
  version: string;
  question_count: number;
  questions: BundleQuestion[];
  categories: Category[];
  deleted_ids: string[];
}

export async function hasLocalQuestions(): Promise<boolean> {
  const [row] = await query<{ n: number }>(
    'SELECT COUNT(*) AS n FROM questions WHERE is_active = 1',
  );
  return (row?.n ?? 0) > 0;
}

export type BundleRefreshResult = 'updated' | 'unchanged' | 'offline';

/** Fetch /bundles/latest and upsert locally if the version moved. */
export async function refreshBundle(): Promise<BundleRefreshResult> {
  let bundle: BundleResponse;
  try {
    bundle = (await client.get<BundleResponse>('/bundles/latest')).data;
  } catch {
    return 'offline';
  }

  const localVersion = await getMeta('bundle_version');
  if (localVersion === bundle.version) return 'unchanged';

  const db = await getDb();
  const statements = [];

  if (bundle.questions.length) {
    statements.push({
      statement: `INSERT INTO questions
          (id, type, text, answer, payload, explanation, mnemonic, source, difficulty, category_id, is_active, bundle_version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        ON CONFLICT(id) DO UPDATE SET
          type = excluded.type, text = excluded.text, answer = excluded.answer,
          payload = excluded.payload, explanation = excluded.explanation,
          mnemonic = excluded.mnemonic, source = excluded.source,
          difficulty = excluded.difficulty, category_id = excluded.category_id,
          is_active = 1, bundle_version = excluded.bundle_version`,
      values: bundle.questions.map((q) => [
        q.id, q.type, q.text, q.answer, JSON.stringify(q.payload),
        q.explanation, q.mnemonic, q.source, q.difficulty, q.category_id,
        bundle.version,
      ]),
    });
  }
  if (bundle.categories.length) {
    statements.push({
      statement: `INSERT INTO categories (id, name, slug, parent_id)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name, slug = excluded.slug, parent_id = excluded.parent_id`,
      values: bundle.categories.map((c) => [c.id, c.name, c.slug, c.parent_id]),
    });
  }
  if (statements.length) {
    await db.executeSet(statements);
  }

  // Tombstones: drop removed/rejected questions and their schedule. The
  // answer_events log keeps its rows (needed for sync; the server skips
  // unknown question ids).
  if (bundle.deleted_ids.length) {
    const placeholders = bundle.deleted_ids.map(() => '?').join(',');
    await run(`DELETE FROM questions WHERE id IN (${placeholders})`, bundle.deleted_ids);
    await run(`DELETE FROM progress WHERE question_id IN (${placeholders})`, bundle.deleted_ids);
  }

  await setMeta('bundle_version', bundle.version);
  await persistWebStore();
  return 'updated';
}
