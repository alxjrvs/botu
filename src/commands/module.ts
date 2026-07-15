// `boom module` — inspect the `use` modules this config composes: each ref, whether it resolves,
// and where. `--update` re-fetches remote modules into the cache (a local path is always live).
// The declarative-composition counterpart to `boom source status`.
import { buildCommand } from "@stricli/core";
import { loadConfig, NO_CONFIG_REPO_MSG, resolveConfigDir } from "../config/load.ts";
import { resolveModule } from "../config/modules.ts";
import type { BoomContext } from "../context.ts";
import { bandsReporter, type Reporter } from "../lib/reporter.ts";

export const moduleCommand = buildCommand<{ update?: boolean; json?: boolean }, [], BoomContext>({
  docs: { brief: "List the `use` modules this config composes and their status; --update re-fetches" },
  parameters: {
    flags: {
      update: { kind: "boolean", optional: true, brief: "Re-fetch remote modules into the cache" },
      json: { kind: "boolean", optional: true, brief: "Emit a structured JSON report" },
    },
  },
  async func(flags) {
    const report = bandsReporter(this.process, this.env, "module", {
      json: flags.json,
      setup: flags.update ? "REFRESHING MODULES…" : "SURVEYING MODULES…",
    });
    const finish = (msgs: Parameters<Reporter["finish"]>[0]): number =>
      flags.json ? report.finishJson(this.process.stdout, msgs.warn !== undefined) : report.finish(msgs);

    const repo = await resolveConfigDir(this.env, this.cwd);
    if (!repo) {
      report.fail(NO_CONFIG_REPO_MSG);
      this.process.exitCode = finish({ ok: "module done", fail: (f) => `module: ${f} failure(s)` });
      return;
    }
    const uses = await loadConfig(repo)
      .then((c) => c.use ?? [])
      .catch((e: Error) => {
        report.fail(e.message);
        return [] as string[];
      });
    if (report.failures > 0) {
      this.process.exitCode = finish({ ok: "module done", fail: (f) => `module: ${f} failure(s)` });
      return;
    }
    if (uses.length === 0) {
      // No header for an empty result — nothing sits under it (the "no empty headline" rule);
      // the verdict carries the message.
      this.process.exitCode = finish({ ok: "module: no modules declared (add a top-level `use = [...]`)" });
      return;
    }

    report.header("Modules");
    for (const ref of uses) {
      const m = await resolveModule(this.env, repo, ref, flags.update);
      if (m.dir) report.ok(`${ref} → ${m.dir}${m.cloned ? " (fetched)" : ""}`);
      else report.warn(`${ref}: ${m.error}`);
    }
    this.process.exitCode = finish({
      ok: `module: ${uses.length} module(s) resolved`,
      warn: (w) => `module: ${w} unresolved`,
      fail: (f) => `module: ${f} failure(s)`,
    });
  },
});
