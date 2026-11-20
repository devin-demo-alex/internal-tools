import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { AUDIT_OUTCOMES } from "./schema";

const OUTCOME_LIST = AUDIT_OUTCOMES.map((outcome) => `'${outcome}'`).join(", ");

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
  outcome TEXT NOT NULL CHECK (outcome IN (${OUTCOME_LIST})),
  "before" TEXT,
  "after" TEXT
);
-- INSERT OR REPLACE and REPLACE INTO remove the old row without firing the
-- DELETE trigger, so an insert that reuses an existing id is refused here.
CREATE TRIGGER IF NOT EXISTS audit_events_no_replace
BEFORE INSERT ON audit_events
WHEN EXISTS (SELECT 1 FROM audit_events WHERE id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only: an existing row cannot be replaced');
END;
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

// A table made by an older version only accepts the outcomes of that version,
// and an append-only table is never rebuilt. Refuse to start rather than fail
// later, after an action has already run.
function assertCurrentTable(sqlite: Database.Database, file: string): void {
  const table = sqlite
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'audit_events'")
    .get() as { sql: string } | undefined;
  if (!table?.sql.includes(`outcome IN (${OUTCOME_LIST})`)) {
    sqlite.close();
    throw new Error(
      `The audit_events table in ${file} was created by an older version and does not accept the outcomes ${OUTCOME_LIST}. Move that file aside and start again.`,
    );
  }
}

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
  assertCurrentTable(sqlite, file);
  holder.__auditDb = { sqlite, orm: drizzle(sqlite) };
  return holder.__auditDb;
}
