// `botu reset` — thin wrapper over engine/reset.ts.
import { buildCommand } from "@stricli/core";
import type { BotuContext } from "../context.ts";
import { resetConfigRepo } from "../engine/reset.ts";

export const resetCommand = buildCommand<{ force?: boolean }, [], BotuContext>({
  docs: { brief: "Discard local changes in the config repo and reset it to origin" },
  parameters: {
    flags: {
      force: {
        kind: "boolean",
        optional: true,
        brief: "Also discard commits no remote has (refused otherwise)",
      },
    },
    aliases: { f: "force" },
  },
  async func(flags) {
    this.process.exitCode = await resetConfigRepo(this, { force: flags.force });
  },
});
