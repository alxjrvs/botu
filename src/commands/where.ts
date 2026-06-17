// `botu where <config|code|engine>` — the single source of truth for resolving
// botu's paths, so other commands never re-derive breadcrumb logic (this kills the
// triplication the audit flagged). Real resolution lands in M1 (config) / M5 (code).
import { buildCommand } from "@stricli/core";

export const whereCommand = buildCommand<Record<never, never>, [string]>({
  docs: { brief: "Print a resolved botu path: config | code | engine" },
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [{ parse: (s: string) => s, placeholder: "target", brief: "config | code | engine" }],
    },
  },
  func(_flags, target) {
    this.process.stdout.write(`botu where ${target}: not yet implemented (M5)\n`);
  },
});
