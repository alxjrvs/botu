// `boom rollback [--run-id <id>] [--list]` — undo a previous sync (the most recent by
// default), or list the runs available to roll back.
import { buildCommand } from "@stricli/core";
import type { BoomContext } from "../context.ts";
import { listRollbacks, rollback } from "../engine/rollback.ts";
import { str } from "./flags.ts";

export const rollbackCommand = buildCommand<
  { runId?: string; list?: boolean; dryRun?: boolean },
  [],
  BoomContext
>({
  docs: { brief: "Undo a previous sync (most recent run, or --run-id); --list to see them" },
  parameters: {
    flags: {
      runId: { kind: "parsed", parse: str, optional: true, brief: "Run id to roll back" },
      list: {
        kind: "boolean",
        optional: true,
        brief: "List the runs available to roll back; change nothing",
      },
      dryRun: { kind: "boolean", optional: true, brief: "Show what would be undone; change nothing" },
    },
  },
  async func(flags) {
    this.process.exitCode = flags.list
      ? await listRollbacks(this)
      : await rollback(this, flags.runId, flags.dryRun);
  },
});
