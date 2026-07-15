// `boom rollback [--run-id <id>] [--list]` — undo a previous sync (the most recent by
// default), or list the runs available to roll back.
import { buildCommand } from "@stricli/core";
import type { BoomContext } from "../context.ts";
import { listRollbacks, rollback, rollbackTo } from "../engine/rollback.ts";
import { str } from "./flags.ts";

export const rollbackCommand = buildCommand<
  { runId?: string; to?: string; list?: boolean; dryRun?: boolean },
  [],
  BoomContext
>({
  docs: {
    brief: "Undo a previous sync (most recent run, --run-id, or --to <checkpoint>); --list to see them",
  },
  parameters: {
    flags: {
      runId: { kind: "parsed", parse: str, optional: true, brief: "Run id to roll back" },
      to: {
        kind: "parsed",
        parse: str,
        optional: true,
        brief: "Roll back to a named checkpoint (see boom checkpoint)",
      },
      list: {
        kind: "boolean",
        optional: true,
        brief: "List the runs available to roll back; change nothing",
      },
      dryRun: { kind: "boolean", optional: true, brief: "Show what would be undone; change nothing" },
    },
  },
  async func(flags) {
    if (flags.list) {
      this.process.exitCode = await listRollbacks(this);
      return;
    }
    // --to returns to a checkpoint by reversing every run made AFTER it (rollbackTo), which is
    // different from rolling back a single run: it's a multi-run rewind, not "undo run X".
    if (flags.to) {
      this.process.exitCode = await rollbackTo(this, flags.to, flags.dryRun);
      return;
    }
    this.process.exitCode = await rollback(this, flags.runId, flags.dryRun);
  },
});
