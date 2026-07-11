// `boom validate` — thin wrapper over engine/validate.ts. Parse + schema-check the
// boomfile and overlays; change nothing. Exit 0 valid / 1 invalid.
import { buildCommand } from "@stricli/core";
import type { BoomContext } from "../context.ts";
import { validateConfig } from "../engine/validate.ts";

export const validateCommand = buildCommand<{ json?: boolean }, [], BoomContext>({
  docs: { brief: "Parse + schema-check the boomfile (and overlays); change nothing" },
  parameters: {
    flags: { json: { kind: "boolean", optional: true, brief: "Emit a structured JSON report" } },
  },
  async func(flags) {
    this.process.exitCode = await validateConfig(this, flags.json);
  },
});
