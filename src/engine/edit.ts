// `boom edit` — open the boomfile in $EDITOR against the managed clone, validate on save, and
// point at `boom source push`. Removes the "where is my config even checked out" round-trip
// (`boom where config` + cd + edit + validate + push) that every small tweak costs today.
import { join } from "node:path";
import { CONFIG_FILE, NO_CONFIG_REPO_MSG, resolveConfigDir } from "../config/load.ts";
import type { BoomContext } from "../context.ts";
import { cleanEnv } from "../lib/proc.ts";
import { bandsReporter } from "../lib/reporter.ts";
import { validateConfigFiles } from "./validate.ts";

export async function edit(ctx: BoomContext): Promise<number> {
  const report = bandsReporter(ctx.process, ctx.env, "edit", { setup: "OPENING THE CONFIG…" });
  const repo = await resolveConfigDir(ctx.env, ctx.cwd);
  if (!repo) {
    report.fail(NO_CONFIG_REPO_MSG);
    return report.finish({ ok: "edit done", fail: (f) => `edit: ${f} failure(s)` });
  }
  const file = join(repo, CONFIG_FILE);

  // No terminal to host an editor (piped, CI, a background job) — don't hang on a blocking `vi`;
  // print the path so the invocation is still useful, and point at the manual next steps.
  if (!(ctx.process.stdout as { isTTY?: boolean }).isTTY) {
    report.header("Config file");
    report.warn(`no interactive terminal — edit ${file} directly, then \`boom source push\``);
    return report.finish({
      ok: "edit: config path shown",
      warn: (w) => `edit: ${w} warning(s)`,
      fail: (f) => `edit: ${f} failure(s)`,
    });
  }

  // Honor an $EDITOR that carries flags ("code -w", "emacsclient -nw") by going through the
  // shell, passing the file as "$1" so a path with spaces is never re-split. Editor stdio is the
  // real process's, so the editor gets the live terminal.
  const editor = ctx.env.VISUAL || ctx.env.EDITOR || "vi";
  const p = Bun.spawnSync(["sh", "-c", `${editor} "$1"`, "sh", file], {
    env: cleanEnv(ctx.env),
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  if (p.exitCode !== 0) report.warn(`editor exited ${p.exitCode ?? "abnormally"}`);

  // Validate what was saved (the same parse `boom doctor --config` runs), so a typo surfaces now
  // rather than on the next machine's sync.
  report.header("Validation");
  await validateConfigFiles(repo, report);
  if (report.failures === 0) report.note("looks good — publish with: boom source push");
  return report.finish({
    ok: "edit: config valid",
    warn: (w) => `edit: ${w} warning(s)`,
    fail: (f) => `edit: ${f} invalid file(s)`,
  });
}
