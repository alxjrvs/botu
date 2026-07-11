// `boom source push` — commit any local changes in the managed config-repo clone and push
// them upstream, in one step. This is the single "save my edits remotely" command: there's
// no separate commit verb, so you never cd into the cache dir to operate the clone by hand.
// `commitLocalChanges` (commit.ts) is the shared commit half — sync's --commit mode uses
// it too, so the default message/behavior can't drift. A clean tree just pushes whatever
// commits are already ahead of the upstream. Exit 0 on success, 1 otherwise (no config
// linked, or git commit/push failed).
import { requireConfigBreadcrumb } from "../config/load.ts";
import type { BoomContext } from "../context.ts";
import { push } from "../lib/git.ts";
import { commitLocalChanges } from "./commit.ts";

export async function pushConfigRepo(ctx: BoomContext, message?: string): Promise<number> {
  const breadcrumb = await requireConfigBreadcrumb(ctx);
  if (!breadcrumb) return 1;

  const commit = commitLocalChanges(breadcrumb.path, ctx.env, message);
  if (commit.kind === "failed") {
    ctx.process.stderr.write(`boom: git commit failed: ${commit.stderr}\n`);
    return 1;
  }
  if (commit.kind === "committed") ctx.process.stdout.write(`boom: committed (${commit.message})\n`);

  const result = push(breadcrumb.path, ctx.env);
  if (result.stdout) ctx.process.stdout.write(`${result.stdout}\n`);
  if (result.stderr) ctx.process.stderr.write(`${result.stderr}\n`);
  if (result.code !== 0) return 1;
  ctx.process.stdout.write("boom: pushed\n");
  return 0;
}
