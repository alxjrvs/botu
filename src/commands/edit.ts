// `boom edit` — open the boomfile in $EDITOR, validate on save, point at push. Thin wrapper.
import { buildCommand } from "@stricli/core";
import type { BoomContext } from "../context.ts";
import { edit } from "../engine/edit.ts";

export const editCommand = buildCommand<Record<never, never>, [], BoomContext>({
  docs: { brief: "Open the boomfile in $EDITOR, validate it on save, then push with boom source push" },
  parameters: {},
  async func() {
    this.process.exitCode = await edit(this);
  },
});
