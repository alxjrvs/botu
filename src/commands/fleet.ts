// `boom fleet` — a cross-machine view built from the per-machine summaries `[boom] fleet`
// records into the config repo. Thin wrapper over engine/fleet.ts; warning-tier exit (0/2).
import { buildCommand } from "@stricli/core";
import type { BoomContext } from "../context.ts";
import { boomFleet } from "../engine/fleet.ts";

export const fleetCommand = buildCommand<{ json?: boolean }, [], BoomContext>({
  docs: { brief: "Show every machine's last-sync summary from the config repo (boom version, drift)" },
  parameters: {
    flags: { json: { kind: "boolean", optional: true, brief: "Emit a structured JSON report" } },
  },
  async func(flags) {
    this.process.exitCode = await boomFleet(this, flags.json);
  },
});
