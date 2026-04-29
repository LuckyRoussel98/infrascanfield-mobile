import * as SQLite from 'expo-sqlite';

import { logger } from '@/utils/logger';

const DB_NAME = 'infrasscanfield.db';
const TABLE = 'outbox';

export type OutboxStatus = 'pending' | 'sending' | 'sent' | 'error';

export interface OutboxRow {
  id: number;
  idempotency_key: string;
  op_type: string;
  payload: string; // JSON-encoded
  status: OutboxStatus;
  last_error: string | null;
  retry_count: number;
  created_at: number;
  updated_at: number;
  sent_at: number | null;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS ${TABLE} (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          idempotency_key TEXT NOT NULL UNIQUE,
          op_type         TEXT NOT NULL,
          payload         TEXT NOT NULL,
          status          TEXT NOT NULL DEFAULT 'pending',
          last_error      TEXT,
          retry_count     INTEGER NOT NULL DEFAULT 0,
          created_at      INTEGER NOT NULL,
          updated_at      INTEGER NOT NULL,
          sent_at         INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_outbox_status_created
          ON ${TABLE}(status, created_at);
      `);
      return db;
    });
  }
  return dbPromise;
}

export async function enqueue<T>(args: {
  op_type: string;
  idempotency_key: string;
  payload: T;
}): Promise<OutboxRow> {
  const db = await getDb();
  const now = Date.now();
  const json = JSON.stringify(args.payload);

  // INSERT OR IGNORE so a duplicate idempotency_key (e.g. retry from validate
  // after a transient error) doesn't double-enqueue.
  await db.runAsync(
    `INSERT OR IGNORE INTO ${TABLE}
       (idempotency_key, op_type, payload, status, retry_count, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', 0, ?, ?)`,
    args.idempotency_key,
    args.op_type,
    json,
    now,
    now,
  );

  const row = await getByIdempotencyKey(args.idempotency_key);
  if (!row) throw new Error('outbox: enqueued row not found');
  return row;
}

export async function getByIdempotencyKey(key: string): Promise<OutboxRow | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<OutboxRow>(
    `SELECT * FROM ${TABLE} WHERE idempotency_key = ?`,
    key,
  );
  return row ?? null;
}

export async function listAll(): Promise<OutboxRow[]> {
  const db = await getDb();
  return db.getAllAsync<OutboxRow>(
    `SELECT * FROM ${TABLE} ORDER BY created_at DESC`,
  );
}

export async function listPending(limit: number = 50): Promise<OutboxRow[]> {
  const db = await getDb();
  return db.getAllAsync<OutboxRow>(
    `SELECT * FROM ${TABLE} WHERE status IN ('pending', 'error') ORDER BY created_at ASC LIMIT ?`,
    limit,
  );
}

export async function countByStatus(): Promise<Record<OutboxStatus, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ status: OutboxStatus; count: number }>(
    `SELECT status, COUNT(*) as count FROM ${TABLE} GROUP BY status`,
  );
  const out: Record<OutboxStatus, number> = { pending: 0, sending: 0, sent: 0, error: 0 };
  for (const r of rows) out[r.status] = r.count;
  return out;
}

export async function markSending(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE ${TABLE} SET status='sending', updated_at=? WHERE id=?`,
    Date.now(),
    id,
  );
}

export async function markSent(id: number): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await db.runAsync(
    `UPDATE ${TABLE} SET status='sent', sent_at=?, updated_at=?, last_error=NULL WHERE id=?`,
    now,
    now,
    id,
  );
}

export async function markError(id: number, error: string, willRetry: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE ${TABLE} SET status=?, retry_count=retry_count+1, last_error=?, updated_at=? WHERE id=?`,
    willRetry ? 'pending' : 'error',
    error.slice(0, 500),
    Date.now(),
    id,
  );
}

export async function resetForRetry(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE ${TABLE} SET status='pending', last_error=NULL, updated_at=? WHERE id=?`,
    Date.now(),
    id,
  );
}

export async function deleteRow(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM ${TABLE} WHERE id=?`, id);
}

/**
 * Cleanup successfully sent rows older than `maxAgeMs` (default 7d).
 * Called periodically by the sync worker so the outbox doesn't grow forever.
 */
export async function purgeOldSent(maxAgeMs: number = 7 * 24 * 3600 * 1000): Promise<number> {
  const db = await getDb();
  const cutoff = Date.now() - maxAgeMs;
  const res = await db.runAsync(
    `DELETE FROM ${TABLE} WHERE status='sent' AND sent_at IS NOT NULL AND sent_at < ?`,
    cutoff,
  );
  if (res.changes > 0) logger.debug('outbox: purged sent rows', { count: res.changes });
  return res.changes;
}

/** Dev / settings-screen helper: wipe everything. */
export async function clearAll(): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM ${TABLE}`);
}
