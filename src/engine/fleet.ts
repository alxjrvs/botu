// Fleet awareness: boom's state.db is per-machine, so nothing answers "which of my machines are
// drifted, on what boom version, synced when." This records a one-file summary of each machine
// into the config repo you already push (`.boom/machines/<host>.json`), and `boom fleet` reads
// them back for a cross-machine view — cheap, because it rides the repo rather than any server.
//
// Churn is deliberately low: the summary carries a *date*, not a timestamp, and is only rewritten
// when its content actually changes — so same-day repeat syncs don't dirty the repo (which would
// otherwise make every later `verify` warn about uncommitted changes). Opt-in via `[boom] fleet`.
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig, resolveConfigDir } from "../config/load.ts";
import { detectOs } from "../config/profile.ts";
import type { BoomContext } from "../context.ts";
import { pathExists } from "../lib/fs.ts";
import { bandsReporter } from "../lib/reporter.ts";
import { VERSION } from "../lib/version.ts";
import type { Env } from "./state.ts";

export interface MachineSummary {
  readonly host: string;
  readonly os: string;
  readonly boom: string; // boom version that last synced this machine
  readonly verdict: "ok" | "warn" | "fail"; // the last sync's outcome
  readonly date: string; // YYYY-MM-DD of the last sync (date, not time, to bound repo churn)
}

export function machinesDir(repo: string): string {
  return join(repo, ".boom", "machines");
}

// The host key for this machine — BOOM_HOST override (also what makes it testable) or the real
// hostname. Shared by the writer and `boom fleet` so a machine recognizes its own row.
export function fleetHost(env: Env): string {
  return env.BOOM_HOST ?? Bun.env.HOSTNAME ?? "unknown";
}

function summaryPath(repo: string, host: string): string {
  return join(machinesDir(repo), `${host}.json`);
}

// Write this machine's summary into the config repo, but only when it changed — a byte-identical
// summary (same day, version, verdict) is left untouched so a repeat sync doesn't dirty the repo.
// Returns whether a write happened, for the caller's report line.
export async function writeMachineSummary(repo: string, summary: MachineSummary): Promise<boolean> {
  const file = summaryPath(repo, summary.host);
  const next = `${JSON.stringify(summary, null, 2)}\n`;
  if ((await pathExists(file)) && (await Bun.file(file).text()) === next) return false;
  await Bun.write(file, next);
  return true;
}

// Read every recorded machine summary (newest sync first). Malformed / partial files are skipped
// rather than failing the whole view — a fleet report should degrade, not crash, on one bad file.
export async function readMachines(repo: string): Promise<MachineSummary[]> {
  const dir = machinesDir(repo);
  if (!(await pathExists(dir))) return [];
  const names = (await readdir(dir)).filter((n) => n.endsWith(".json"));
  const out: MachineSummary[] = [];
  for (const name of names) {
    try {
      const raw = JSON.parse(await Bun.file(join(dir, name)).text()) as Partial<MachineSummary>;
      if (raw.host && raw.os && raw.boom && raw.verdict && raw.date) out.push(raw as MachineSummary);
    } catch {
      // skip an unreadable/partial summary
    }
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

// `boom fleet` — the cross-machine view. Lists each recorded machine and flags the ones worth
// attention: a machine whose last sync wasn't clean, or one running an older boom than the
// newest in the fleet (a drift signal of its own). Warning-tier exit (0/2), like verify/doctor.
export async function boomFleet(ctx: BoomContext, json = false): Promise<number> {
  const report = bandsReporter(ctx.process, ctx.env, "fleet", { json, setup: "SURVEYING THE FLEET…" });
  const finish = (): number =>
    json
      ? report.finishJson(ctx.process.stdout, true)
      : report.finish({
          ok: "fleet: all machines current + clean",
          warn: (w) => `fleet: ${w} machine(s) need attention`,
          fail: (f) => `fleet: ${f} failure(s)`,
        });

  const repo = await resolveConfigDir(ctx.env, ctx.cwd);
  if (!repo) {
    report.fail("no config repo linked — run `boom source set <owner/repo>`");
    return finish();
  }
  // Surface whether fleet recording is even enabled, so an empty view isn't mistaken for
  // "no machines" when it's really "nobody opted in".
  const enabled = await loadConfig(repo)
    .then((c) => Boolean(c.boom?.fleet))
    .catch(() => false);

  const machines = await readMachines(repo);
  if (machines.length === 0) {
    report.header("Fleet");
    report.warn(
      enabled
        ? "no machine summaries yet — sync a machine with `[boom] fleet` enabled, then push"
        : "fleet recording is off — set `fleet = true` under [boom] and sync to start",
    );
    return finish();
  }

  const newest = machines
    .map((m) => m.boom)
    .sort(cmpVersion)
    .at(-1);
  const self = fleetHost(ctx.env);
  report.header("Fleet");
  for (const m of machines) {
    const here = m.host === self ? " (this machine)" : "";
    const line = `${m.host}${here} — boom v${m.boom}, ${m.os}, synced ${m.date}`;
    if (m.verdict === "fail") report.warn(`${line} — last sync had failures`);
    else if (m.verdict === "warn") report.warn(`${line} — last sync had warnings`);
    else if (newest && cmpVersion(m.boom, newest) < 0) report.warn(`${line} — behind v${newest}`);
    else report.ok(line);
  }
  return finish();
}

// Component-wise numeric semver compare (release strings only, no pre-release suffixes ship) —
// the same shape settings.ts/isNewer uses, kept local so fleet has no cross-module coupling.
function cmpVersion(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}

// Build this machine's summary from a completed reconcile's tally. Kept here (next to the reader)
// so the recorded shape has one owner. `date` is UTC yyyy-mm-dd — coarse on purpose (see above).
export function machineSummary(env: Env, verdict: MachineSummary["verdict"]): MachineSummary {
  return {
    host: fleetHost(env),
    os: detectOs(env),
    boom: VERSION,
    verdict,
    date: new Date().toISOString().slice(0, 10),
  };
}
