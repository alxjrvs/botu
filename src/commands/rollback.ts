// `boom rollback [--run-id <id>] [--list]` — undo a previous sync (the most recent by
// default), or list the runs available to roll back.
import { buildCommand } from "@stricli/core";
import type { BoomContext } from "../context.ts";
import { listRollbacks, resolveCheckpoint, rollback } from "../engine/rollback.ts";
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
    // --to resolves a checkpoint name to its run id before rolling back; an unknown name is a
    // clean error, not a silent fall-through to "most recent run" (which could undo the wrong one).
    let runId = flags.runId;
    if (flags.to) {
      runId = await resolveCheckpoint(this, flags.to);
      if (!runId) {
        this.process.stderr.write(`boom: no checkpoint named '${flags.to}' — see \`boom rollback --list\`\n`);
        this.process.exitCode = 1;
        return;
      }
    }
    this.process.exitCode = await rollback(this, runId, flags.dryRun);
  },
});
