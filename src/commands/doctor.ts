// `boom doctor` — thin wrapper over engine/doctor.ts. Reports boom's own preconditions
// (config, tools, keychain, state) and sets the exit code (0 ok / 2 warn / 1 fail).
import { buildCommand } from "@stricli/core";
import type { BoomContext } from "../context.ts";
import { doctor } from "../engine/doctor.ts";

export const doctorCommand = buildCommand<{ json?: boolean }, [], BoomContext>({
  docs: { brief: "Check boom's own preconditions (config, tools, keychain, state)" },
  parameters: {
    flags: { json: { kind: "boolean", optional: true, brief: "Emit a structured JSON report" } },
  },
  async func(flags) {
    this.process.exitCode = await doctor(this, flags.json);
  },
});
