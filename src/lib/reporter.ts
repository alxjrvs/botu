// Reporter: the engine's output surface + pass/fail tally. Mirrors the bash engine's
// _ok/_warn/_fail and drives the verify exit code (0 ok / 2 warn / 1 fail). In JSON
// mode it suppresses human output and only collects records (for `verify --json`).
import { type ColorName, paint } from "./color.ts";

interface Stream {
  write(s: string): void;
}

export type ReportLevel = "ok" | "skip" | "warn" | "fail" | "note" | "plan" | "header";
export interface ReportRecord {
  readonly level: ReportLevel;
  readonly msg: string;
}

// Version of the `--json` report envelope. Bump when its shape changes so a script consuming
// `verify --json` / `doctor --json` / etc. can detect (and refuse) an unknown shape.
export const REPORT_SCHEMA_VERSION = 1;

export interface ReportEnvelope {
  readonly schemaVersion: number;
  readonly ok: boolean;
  readonly warnings: number;
  readonly failures: number;
  readonly records: readonly ReportRecord[];
}

export class Reporter {
  warnings = 0;
  failures = 0;
  readonly records: ReportRecord[] = [];

  // Quiet mode (the default) holds a section header back until a *shown* line lands under it,
  // so a section that produced only suppressed `skip` noise prints no header at all — the whole
  // point of quiet output being that a steady-state run says almost nothing. Verbose writes
  // headers eagerly and this stays undefined.
  private pendingHeader?: string;

  constructor(
    private readonly out: Stream,
    private readonly err: Stream,
    private readonly color: boolean,
    private readonly json = false,
    // Verbose shows every line (the historical firehose: each ✓/skip/note). Quiet — the CLI
    // default — suppresses the `skip` no-ops (already-linked, unchanged, satisfied) and the
    // headers of sections that emit only those, leaving what changed + what needs attention.
    private readonly verbose = false,
  ) {}

  private c(name: ColorName, s: string): string {
    return paint(this.color, name, s);
  }

  // Flush a header the quiet path is holding back — called by every *shown* line so its section
  // banner precedes it. A no-op in verbose (headers already wrote) and once already flushed.
  private flushHeader(): void {
    if (this.pendingHeader !== undefined) {
      this.out.write(`\n${this.c("bold", `==> ${this.pendingHeader}`)}\n`);
      this.pendingHeader = undefined;
    }
  }

  // `eager` marks a run-level banner (e.g. the dry-run notice) that must print even with no
  // lines under it — quiet holds *section* headers back, but not these.
  header(s: string, eager = false): void {
    this.records.push({ level: "header", msg: s });
    if (this.json) return;
    if (this.verbose) {
      this.out.write(`\n${this.c("bold", `==> ${s}`)}\n`);
      return;
    }
    // Quiet: stage this header. A following header with no shown line in between overwrites
    // (and thereby discards) it — the previous section was all-skips; `eager` flushes now.
    this.pendingHeader = s;
    if (eager) this.flushHeader();
  }
  ok(s: string): void {
    this.records.push({ level: "ok", msg: s });
    if (this.json) return;
    this.flushHeader();
    this.out.write(`  ${this.c("green", "✓")} ${s}\n`);
  }
  // A no-op: already in the desired state, nothing done. Pure noise on a steady-state run, so
  // quiet suppresses it (records still capture it for `--json`); verbose shows the dim line.
  skip(s: string): void {
    this.records.push({ level: "skip", msg: s });
    if (this.json || !this.verbose) return;
    this.flushHeader();
    this.out.write(`  ${this.c("dim", `- ${s}`)}\n`);
  }
  note(s: string): void {
    this.records.push({ level: "note", msg: s });
    if (this.json) return;
    this.flushHeader();
    this.out.write(`    ${s}\n`);
  }
  plan(s: string): void {
    this.records.push({ level: "plan", msg: s });
    if (this.json) return;
    this.flushHeader();
    this.out.write(`  ${this.c("cyan", `~ ${s}`)}\n`);
  }
  warn(s: string): void {
    this.warnings++;
    this.records.push({ level: "warn", msg: s });
    if (this.json) return;
    this.flushHeader();
    this.out.write(`  ${this.c("yellow", "→")} ${s}\n`);
  }
  fail(s: string): void {
    this.failures++;
    this.records.push({ level: "fail", msg: s });
    if (this.json) return;
    this.flushHeader();
    this.err.write(`  ${this.c("red", "✗")} ${s}\n`);
  }

  // The one place the 0/2/1 exit contract lives: write a trailing blank line + a summary
  // line at the right severity, and return the exit code — so reconcile/doctor/validate/
  // rollback stop each re-implementing the same failures→1 / warnings→2 / ok→0 ladder with
  // subtly different wording. Callers pass only the varying messages. Omitting `warn` means
  // "no warning tier" (warnings don't change the exit code) — the mutating/validate case.
  // Exit code is decided from the counts *before* the summary line is emitted, so the
  // summary's own fail()/warn() call can't perturb it.
  finish(msgs: {
    ok: string;
    fail?: (failures: number, warnings: number) => string;
    warn?: (warnings: number) => string;
  }): number {
    const f = this.failures;
    const w = this.warnings;
    // Discard a section header still held back from the last (all-skips) section, so quiet
    // mode doesn't print a stray banner right before the summary. The summary itself is an
    // `ok`/`warn`/`fail` line and is always shown.
    this.pendingHeader = undefined;
    this.out.write("\n");
    if (f > 0) {
      this.fail(msgs.fail ? msgs.fail(f, w) : `${f} failure(s)`);
      return 1;
    }
    if (msgs.warn && w > 0) {
      this.warn(msgs.warn(w));
      return 2;
    }
    this.ok(msgs.ok);
    return 0;
  }

  // The one `--json` envelope shape, shared by every scriptable command so their reports
  // can't drift. Built from the tally + collected records.
  envelope(schemaVersion = REPORT_SCHEMA_VERSION): ReportEnvelope {
    return {
      schemaVersion,
      ok: this.failures === 0,
      warnings: this.warnings,
      failures: this.failures,
      records: this.records,
    };
  }

  // The json-mode twin of finish(): write the envelope and return the exit code. failures→1;
  // warnings→2 only for a command with a warning tier (verify/doctor), else 0 — the same
  // 0/2/1 ladder finish() applies to human output, so the two modes agree on exit codes.
  finishJson(out: Stream, hasWarnTier: boolean, schemaVersion = REPORT_SCHEMA_VERSION): number {
    out.write(`${JSON.stringify(this.envelope(schemaVersion))}\n`);
    return this.failures > 0 ? 1 : hasWarnTier && this.warnings > 0 ? 2 : 0;
  }
}
