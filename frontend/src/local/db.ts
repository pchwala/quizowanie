import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite';

/**
 * Platform-aware SQLite connection — the ONE place the web/native split is
 * handled. Native Android uses the real plugin; web falls back to the
 * jeep-sqlite wasm web component persisted to IndexedDB.
 *
 * The local database is the source of truth for the user: questions cache,
 * SRS progress, and the offline answer-event log all live here.
 */

const DB_NAME = 'quizowanie';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  text TEXT NOT NULL,
  answer TEXT NOT NULL,
  payload TEXT NOT NULL,
  explanation TEXT,
  mnemonic TEXT,
  source TEXT NOT NULL,
  difficulty INTEGER,
  category_id TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  bundle_version TEXT,
  is_user_owned INTEGER NOT NULL DEFAULT 0,
  is_public INTEGER,
  verification_status TEXT,
  synced INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  parent_id TEXT
);
CREATE TABLE IF NOT EXISTS progress (
  question_id TEXT PRIMARY KEY,
  repetitions INTEGER NOT NULL DEFAULT 0,
  easiness_factor REAL NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 0,
  next_review_at TEXT,
  last_reviewed_at TEXT,
  last_quality INTEGER
);
CREATE TABLE IF NOT EXISTS answer_events (
  event_id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  quality INTEGER NOT NULL,
  answered_at TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'mixed',
  synced INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS question_flags (
  client_id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL,
  synced INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category_id);
CREATE INDEX IF NOT EXISTS idx_progress_next_review ON progress(next_review_at);
CREATE INDEX IF NOT EXISTS idx_answer_events_synced ON answer_events(synced);
CREATE INDEX IF NOT EXISTS idx_question_flags_synced ON question_flags(synced);
`;

let sqlite: SQLiteConnection | null = null;
let dbPromise: Promise<SQLiteDBConnection> | null = null;

async function init(): Promise<SQLiteDBConnection> {
  sqlite = new SQLiteConnection(CapacitorSQLite);

  if (Capacitor.getPlatform() === 'web') {
    // Mount the jeep-sqlite web component (registered in main.tsx) and load
    // any previously persisted database from IndexedDB.
    const jeep = document.createElement('jeep-sqlite');
    jeep.autoSave = true;
    document.body.appendChild(jeep);
    await customElements.whenDefined('jeep-sqlite');
    await sqlite.initWebStore();
  }

  const db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
  await db.open();
  await db.execute(SCHEMA);
  await migrate(db);
  return db;
}

/**
 * Idempotent column migrations for installs that already have a `questions`
 * table (CREATE TABLE IF NOT EXISTS won't add new columns). Adds the
 * user-authored-question columns when missing.
 */
async function migrate(db: SQLiteDBConnection): Promise<void> {
  const res = await db.query('PRAGMA table_info(questions)');
  const cols = new Set((res.values ?? []).map((r) => (r as { name: string }).name));
  const additions: [string, string][] = [
    ['is_user_owned', 'INTEGER NOT NULL DEFAULT 0'],
    ['is_public', 'INTEGER'],
    ['verification_status', 'TEXT'],
    ['synced', 'INTEGER NOT NULL DEFAULT 1'],
  ];
  for (const [name, def] of additions) {
    if (!cols.has(name)) {
      await db.execute(`ALTER TABLE questions ADD COLUMN ${name} ${def}`);
    }
  }
}

export function getDb(): Promise<SQLiteDBConnection> {
  if (!dbPromise) {
    // Reset on failure so a retry (e.g. the bootstrap retry button) can recover.
    dbPromise = init().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

/** Persist to IndexedDB on web (no-op on native, where writes are durable). */
export async function persistWebStore(): Promise<void> {
  if (Capacitor.getPlatform() === 'web' && sqlite) {
    await sqlite.saveToStore(DB_NAME);
  }
}

// ---- Thin helpers -----------------------------------------------------------

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const db = await getDb();
  const res = await db.query(sql, params as never[]);
  return (res.values ?? []) as T[];
}

export async function run(sql: string, params: unknown[] = []): Promise<void> {
  const db = await getDb();
  await db.run(sql, params as never[]);
}

export async function getMeta(key: string): Promise<string | null> {
  const rows = await query<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key]);
  return rows[0]?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await run(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}
