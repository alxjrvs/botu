// A cross-process lock for mutating reconcile runs. Two concurrent `boom sync`/`repair`
// runs would race on the same filesystem destinations and, worse, clobber each other's
// manifest (writeManifest is a full DELETE+reinsert) — the slower run silently drops the
// other's ownership records, so those links later look orphaned and get reaped. This is
// especially reachable when a scheduled/launchd sync overlaps a manual one. A plain
// lockfile is enough: exclusive-create (O_EXCL) under the state dir, holding the owner's
// pid so a stale lock from a crashed run is distinguishable from a live one and reclaimed.
import { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeSync } from "node:fs";
import { join } from "node:path";
import { boomStateDir, type Env } from "../engine/state.ts";

// A live run holds the lock (as opposed to an unexpected fs error) — reconcile reports this
// as a clean failure rather than a crash.
export class LockHeldError extends Error {}

function lockPath(env: Env): string {
  return join(boomStateDir(env), "lock");
}

// Whether a process with `pid` is alive. `kill(pid, 0)` sends no signal — it only probes:
// it throws ESRCH when the process is gone, EPERM when it exists but we may not signal it
// (still alive → still holding the lock).
function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

function readPid(path: string): number {
  try {
    return Number.parseInt(readFileSync(path, "utf8").trim(), 10);
  } catch {
    return Number.NaN;
  }
}

// Acquire the mutating-run lock, returning an idempotent release fn. Throws LockHeldError
// if another live run holds it; a stale lock left by a crashed run (dead pid, or a
// truncated file from a mid-write crash) is reclaimed.
export function acquireLock(env: Env): () => void {
  const path = lockPath(env);
  mkdirSync(boomStateDir(env), { recursive: true });
  // "wx" = create + fail with EEXIST if it already exists — the atomic test-and-set.
  const create = (): number => openSync(path, "wx");

  let fd: number;
  try {
    fd = create();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    const owner = readPid(path);
    if (Number.isFinite(owner) && pidAlive(owner)) {
      throw new LockHeldError(
        `another boom run is in progress (pid ${owner}) — wait for it to finish, or remove ${path} if it crashed`,
      );
    }
    // Stale lock (dead or unreadable pid): reclaim it. A racing process that recreates the
    // file between the unlink and re-create surfaces as EEXIST again — treated as held.
    unlinkSync(path);
    try {
      fd = create();
    } catch {
      throw new LockHeldError(`another boom run just took the lock — retry in a moment (${path})`);
    }
  }

  writeSync(fd, String(process.pid));
  closeSync(fd);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    try {
      unlinkSync(path);
    } catch {
      // Best-effort: a missing lock file is already the released state.
    }
  };
}
