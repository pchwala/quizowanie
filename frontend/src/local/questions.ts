import { type Category, type QuestionDetail, type QuestionSource, type QuestionType } from '../types/api';
import { buildOptions } from './options';
import { query } from './db';

/** Raw row shape of the local `questions` table. */
export interface QuestionRow {
  id: string;
  type: QuestionType;
  text: string;
  answer: string;
  payload: string; // JSON
  explanation: string | null;
  mnemonic: string | null;
  source: QuestionSource;
  difficulty: number | null;
  category_id: string;
  is_active: number;
}

export function rowToDetail(row: QuestionRow): QuestionDetail {
  const payload = JSON.parse(row.payload) as Record<string, unknown>;
  return {
    id: row.id,
    type: row.type,
    text: row.text,
    source: row.source,
    difficulty: row.difficulty,
    category_id: row.category_id,
    options: buildOptions(row.type, payload),
    answer: row.answer,
    payload,
    explanation: row.explanation,
    mnemonic: row.mnemonic,
  };
}

export async function getLocalQuestion(id: string): Promise<QuestionDetail | null> {
  const rows = await query<QuestionRow>(
    'SELECT * FROM questions WHERE id = ? AND is_active = 1',
    [id],
  );
  return rows[0] ? rowToDetail(rows[0]) : null;
}

export interface LocalBrowseFilters {
  category_id?: string;
  type?: QuestionType;
  source?: QuestionSource;
  difficulty_min?: number;
  difficulty_max?: number;
  limit?: number;
  offset?: number;
}

export interface LocalBrowsePage {
  items: QuestionDetail[];
  total: number;
}

/** Local equivalent of GET /browse/questions (same filters + pagination). */
export async function browseLocalQuestions(filters: LocalBrowseFilters = {}): Promise<LocalBrowsePage> {
  const where: string[] = ['is_active = 1'];
  const params: unknown[] = [];
  if (filters.category_id) {
    where.push('category_id = ?');
    params.push(filters.category_id);
  }
  if (filters.type) {
    where.push('type = ?');
    params.push(filters.type);
  }
  if (filters.source) {
    where.push('source = ?');
    params.push(filters.source);
  }
  if (filters.difficulty_min != null) {
    where.push('difficulty >= ?');
    params.push(filters.difficulty_min);
  }
  if (filters.difficulty_max != null) {
    where.push('difficulty <= ?');
    params.push(filters.difficulty_max);
  }
  const whereSql = where.join(' AND ');

  const [countRow] = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM questions WHERE ${whereSql}`,
    params,
  );
  const rows = await query<QuestionRow>(
    `SELECT * FROM questions WHERE ${whereSql} ORDER BY id LIMIT ? OFFSET ?`,
    [...params, filters.limit ?? 50, filters.offset ?? 0],
  );
  return { items: rows.map(rowToDetail), total: countRow?.total ?? 0 };
}

export async function getLocalCategories(): Promise<Category[]> {
  return query<Category>('SELECT id, name, slug, parent_id FROM categories ORDER BY name');
}
