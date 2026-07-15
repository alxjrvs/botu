// The `run` resource: an inline shell step bound to one or more verbs. Ports engine/run's
// `on` primitive — `sync` fires on the sync verb (bare or `--fix`); `verify` on verify;
// `uninstall` on uninstall (the teardown direction, symmetric with hooks). `on` accepts a
// list, so a step that fires on both sync and uninstall is one entry, not a duplicated pair.
import type { Run } from "../../config/schema.ts";
import { lastLine, runShellAsync, toolIo } from "../../lib/proc.ts";
import type { ReconcileCtx } from "../types.ts";

// A compact spinner label for a shell step: the first line, clipped, so the active-work line
// reads `  ✸ lefthook install…` rather than echoing a multi-line command.
function stepLabel(cmd: string): string {
  const first = cmd.split("\n")[0]?.trim() ?? cmd;
  return first.length > 48 ? `${first.slice(0, 47)}…` : first;
}

export async function reconcileRun(entry: Run, ctx: ReconcileCtx): Promise<void> {
  const on = Array.isArray(entry.on) ? entry.on : [entry.on];
  if (!on.includes(ctx.verb)) return;

  if ((ctx.verb === "sync" || ctx.verb === "uninstall") && ctx.dryRun) {
    ctx.report.plan(`would run: ${entry.cmd}`);
    return;
  }
  // Journal the shell step as a non-reversible side effect so rollback can warn that
  // re-running it won't be undone. Only a mutating sync carries a journal.
  if (ctx.verb === "sync") await ctx.journal?.side("run", entry.cmd);
  // Run from the dotfiles repo, not the invocation cwd, so sync is cwd-independent:
  // a step like `lefthook install` targets the repo's `.git`, not whatever directory
  // `boom` was called from. Steps that name absolute / `~`-anchored paths are unaffected.
  const { code, timedOut, stderr } = await ctx.report.spin(stepLabel(entry.cmd), () =>
    runShellAsync(entry.cmd, ctx.env, {
      ...toolIo(ctx.json, ctx.verbose),
      cwd: ctx.repo,
      timeoutMs: entry.timeout ? entry.timeout * 1000 : undefined,
    }),
  );
  if (timedOut) ctx.report.fail(`${entry.cmd} (timed out after ${entry.timeout}s)`);
  else if (code !== 0)
    ctx.report.fail(`${entry.cmd} (exit ${code})${lastLine(stderr) ? `: ${lastLine(stderr)}` : ""}`);
}
