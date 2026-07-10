// `botu diff` — thin wrapper over engine/diff.ts.
import { buildCommand } from "@stricli/core";
import type { BotuContext } from "../context.ts";
import { diffConfigRepo } from "../engine/diff.ts";

export const diffCommand = buildCommand<Record<never, never>, [], BotuContext>({
  docs: { brief: "Show uncommitted local changes in the config repo" },
  parameters: {},
  async func() {
    this.process.exitCode = await diffConfigRepo(this);
  },
});
