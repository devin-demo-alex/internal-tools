import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

// Idempotent. The triggers make the table append-only at the database level;
// never remove or weaken them.
const SETUP_SQL = `
CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  app TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('allowed', 'denied')),
  "before" TEXT,
  "after" TEXT
);
CREATE TRIGGER IF NOT EXISTS audit_events_no_update
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only: UPDATE is not allowed');
END;
CREATE TRIGGER IF NOT EXISTS audit_events_no_delete
BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only: DELETE is not allowed');
END;
`;

type AuditDb = { sqlite: Database.Database; orm: BetterSQLite3Database };

// Kept on globalThis so dev-server reloads reuse one connection.
const holder = globalThis as typeof globalThis & { __auditDb?: AuditDb };

/** The audit database. AUDIT_DB_PATH overrides the file (":memory:" in tests). */
export function getAuditDb(): AuditDb {
  if (holder.__auditDb) return holder.__auditDb;
  const file =
    process.env.AUDIT_DB_PATH ?? path.join(process.cwd(), ".data", "audit.db");
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(SETUP_SQL);
  holder.__auditDb = { sqlite, orm: drizzle(sqlite) };
  return holder.__auditDb;
}
