// The osx_default resource: `defaults write/read` a macOS default. OS-gated to
// darwin (a no-op elsewhere), like the bash engine. Marks ctx.osx.changed so apply
// can restart the owning UI processes at the end of the run.
import { detectOs } from "../../config/profile.ts";
import type { OsxDefault } from "../../config/schema.ts";
import { cleanEnv } from "../../lib/proc.ts";
import type { ReconcileCtx } from "../types.ts";

export function reconcileOsxDefault(entry: OsxDefault, ctx: ReconcileCtx): void {
  if (detectOs(ctx.env) !== "darwin") return;
  const { report } = ctx;
  const { domain, key, type, value } = entry;
  const disp = `${domain} ${key}`;
  const env = cleanEnv(ctx.env);

  switch (ctx.verb) {
    case "apply":
    case "fix": {
      if (ctx.dryRun) {
        report.plan(`would set ${disp} -${type} ${value}`);
        return;
      }
      const p = Bun.spawnSync(["defaults", "write", domain, key, `-${type}`, String(value)], {
        env,
        stdout: "ignore",
        stderr: "ignore",
      });
      if (p.exitCode === 0) {
        report.ok(`${disp} = ${value}`);
        ctx.osx.changed = true;
      } else {
        report.fail(`${disp} (defaults write failed)`);
      }
      return;
    }
    case "verify": {
      const p = Bun.spawnSync(["defaults", "read", domain, key], { env, stdout: "pipe", stderr: "ignore" });
      const cur = p.exitCode === 0 ? new TextDecoder().decode(p.stdout).trim() : "";
      let want = String(value);
      if (value === true) want = "1";
      else if (value === false) want = "0";
      if (cur === want) report.ok(`${disp} = ${want}`);
      else report.warn(`${disp} = ${cur || "<unset>"}, expected ${want}`);
      return;
    }
    case "uninstall":
      return;
  }
}
