// The sync transaction journal: an append-only NDJSON log per run. Each mutation
// writes an `intent` then a `done` (with an undo token); a clean run ends `committed`.
// rollback replays `done` records in reverse; --resume skips destinations already done.
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { backupsDir, type Env, journalDir } from "./state.ts";

// How to reverse one mutation: remove what we created, or restore a backed-up file.
export type UndoToken = { kind: "remove" } | { kind: "restore"; from: string };

export interface DoneRecord {
  t: "done";
  op: string;
  dst: string;
  undo: UndoToken;
}

// A non-reversible side effect (a `run` step or `hook`) — journaled so rollback can
// warn the operator that replaying the run cannot undo it.
export interface SideRecord {
  t: "side";
  op: string;
  label: string;
}

export function newRunId(): string {
  // ISO timestamp (lexically sortable = chronological) + pid for intra-machine uniqueness.
  return `${new Date().toISOString().replace(/[:.]/g, "-")}-${process.pid}`;
}

export class Journal {
  private readonly file: string;
  private sink?: Bun.FileSink;
  readonly runId: string;

  constructor(env: Env, runId: string) {
    this.runId = runId;
    this.file = join(journalDir(env), `${runId}.ndjson`);
  }

  // One persistent, buffered handle instead of an open→write→close per record, and the
  // dir is created once on first write rather than before every append. The runId is
  // unique per run (timestamp + pid), so this file is never shared or appended-to across
  // runs — writing from the start is correct.
  private async writer(): Promise<Bun.FileSink> {
    if (!this.sink) {
      await mkdir(dirname(this.file), { recursive: true });
      this.sink = Bun.file(this.file).writer();
    }
    return this.sink;
  }

  private async append(obj: unknown): Promise<void> {
    const sink = await this.writer();
    sink.write(`${JSON.stringify(obj)}\n`);
    // Flush each record: this is a crash-recovery log, so a partially-applied run must
    // leave its intents/dones durably on disk for --resume / rollback to read.
    await sink.flush();
  }

  intent(op: string, dst: string): Promise<void> {
    return this.append({ t: "intent", op, dst });
  }
  done(op: string, dst: string, undo: UndoToken): Promise<void> {
    return this.append({ t: "done", op, dst, undo });
  }
  side(op: string, label: string): Promise<void> {
    return this.append({ t: "side", op, label });
  }
  commit(): Promise<void> {
    return this.append({ t: "committed" });
  }
}

// Keep the last `keep` runs; delete older journals and their backup trees. Rollback
// only ever reads the most recent run, so unbounded journals + full backup copies are
// pure accumulation. Called after a clean commit.
export async function pruneRuns(env: Env, keep = 10): Promise<void> {
  const dir = journalDir(env);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".ndjson")).sort();
  } catch {
    return;
  }
  for (const f of files.slice(0, Math.max(0, files.length - keep))) {
    const id = f.replace(/\.ndjson$/, "");
    await rm(join(dir, f), { force: true });
    await rm(join(backupsDir(env), id), { recursive: true, force: true });
  }
}

// Read a run's `done` + `side` records (the most recent run if `runId` is omitted).
export async function readRun(
  env: Env,
  runId?: string,
): Promise<{ runId: string; done: DoneRecord[]; sides: SideRecord[] } | undefined> {
  const dir = journalDir(env);
  let id = runId;
  if (!id) {
    try {
      const files = (await readdir(dir)).filter((f) => f.endsWith(".ndjson")).sort();
      id = files.at(-1)?.replace(/\.ndjson$/, "");
    } catch {
      return undefined;
    }
  }
  if (!id) return undefined;
  let text: string;
  try {
    text = await readFile(join(dir, `${id}.ndjson`), "utf8");
  } catch {
    return undefined;
  }
  const done: DoneRecord[] = [];
  const sides: SideRecord[] = [];
  for (const line of text.split("\n")) {
    if (line.length === 0) continue;
    const rec = JSON.parse(line) as { t: string };
    if (rec.t === "done") done.push(rec as DoneRecord);
    else if (rec.t === "side") sides.push(rec as SideRecord);
  }
  return { runId: id, done, sides };
}

// One-line summary of a recorded run, for `boom rollback --list`: how many reversible
// ops it holds, how many non-reversible side effects, and whether it reached a clean
// `committed` end (an uncommitted run was interrupted mid-sync).
export interface RunSummary {
  readonly runId: string;
  readonly ops: number;
  readonly sides: number;
  readonly committed: boolean;
}

// Enumerate the retained runs, newest first — the missing counterpart to `--run-id`,
// which until now had no way to discover the ids it accepts.
export async function listRuns(env: Env): Promise<RunSummary[]> {
  const dir = journalDir(env);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".ndjson")).sort();
  } catch {
    return [];
  }
  const out: RunSummary[] = [];
  for (const f of files) {
    let text: string;
    try {
      text = await readFile(join(dir, f), "utf8");
    } catch {
      continue;
    }
    let ops = 0;
    let sides = 0;
    let committed = false;
    for (const line of text.split("\n")) {
      if (line.length === 0) continue;
      const rec = JSON.parse(line) as { t: string };
      if (rec.t === "done") ops++;
      else if (rec.t === "side") sides++;
      else if (rec.t === "committed") committed = true;
    }
    out.push({ runId: f.replace(/\.ndjson$/, ""), ops, sides, committed });
  }
  return out.reverse(); // newest first (filenames sort chronologically)
}
