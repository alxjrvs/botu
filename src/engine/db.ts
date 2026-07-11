// boom's on-disk state as a single bun:sqlite database (state.db under the state dir),
// replacing the hand-parsed TSV manifest + per-run NDJSON journals. One store, real
// transactions, and — the reason it matters for a crash-recovery log — no torn-line
// problem: each journal row is committed atomically as it happens (WAL), so an interrupted
// run leaves whole rows, never a half-written record for the reader to trip over.
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { type Env, stateHome } from "./state.ts";

export function dbPath(env: Env): string {
  return join(stateHome(env), "boom", "state.db");
}

// Open the state DB (creating the dir + schema on first touch). WAL so a reader (rollback,
// verify's drift check) never blocks the writer mid-sync. Callers close it when done; the
// Journal holds one open for a run's lifetime, one-shot readers open+close.
export function openDb(env: Env): Database {
  mkdirSync(join(stateHome(env), "boom"), { recursive: true });
  const db = new Database(dbPath(env), { create: true });
  db.run("PRAGMA journal_mode = WAL");
  // Individual statements (not one multi-statement string) — bun:sqlite's run() prepares a
  // single statement. All idempotent (IF NOT EXISTS), so this is a no-op after first open.
  db.run("CREATE TABLE IF NOT EXISTS manifest (dst TEXT PRIMARY KEY, kind TEXT NOT NULL, src TEXT NOT NULL)");
  db.run("CREATE TABLE IF NOT EXISTS runs (run_id TEXT PRIMARY KEY, committed INTEGER NOT NULL DEFAULT 0)");
  // ops.t is 'intent' | 'done'; undo is a JSON UndoToken, present for 'done' rows.
  db.run(
    "CREATE TABLE IF NOT EXISTS ops (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, t TEXT NOT NULL, op TEXT NOT NULL, dst TEXT NOT NULL, undo TEXT)",
  );
  db.run(
    "CREATE TABLE IF NOT EXISTS sides (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, op TEXT NOT NULL, label TEXT NOT NULL)",
  );
  return db;
}

// Open, run, close — for the one-shot readers/writers (manifest, readRun, listRuns, prune).
export function withDb<T>(env: Env, fn: (db: Database) => T): T {
  const db = openDb(env);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}
