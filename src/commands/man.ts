// `boom man` — emit the boom(1) man page in roff to stdout. Generated from the command
// catalog so it never drifts from the route map. Install:  boom man > ~/.local/share/man/man1/boom.1
import { buildCommand } from "@stricli/core";
import type { BoomContext } from "../context.ts";
import { VERSION } from "../lib/version.ts";
import { commandList } from "./catalog.ts";

// Escape the roff comment/escape lead-in. Briefs never start a line with a control
// char (they follow .B on the previous line), so only the escape char needs guarding.
const roff = (s: string): string => s.replace(/\\/g, "\\\\");

export function manPage(version: string): string {
  const commands = commandList()
    .map((c) => `.TP\n.B ${c.name}\n${roff(c.brief)}`)
    .join("\n");
  return `.TH BOOM 1 "" "boom ${version}" "boom manual"
.SH NAME
boom \\- a workspace manager (provision a machine + open portals to your code)
.SH SYNOPSIS
.B boom
.I command
[\\fIoptions\\fR]
.SH DESCRIPTION
boom reconciles a machine from a declarative
.I boomfile.toml
\\(em symlinking and copying dotfiles, installing
packages, running steps and hooks \\(em and opens
portals to your code workspaces.
It is a single self-contained binary.
The reconcile verbs (\\fBsource\\fR/\\fBsync\\fR, verify,
repair, uninstall) share one loop over a resource
registry, and rollback undoes the most recent sync.
.SH COMMANDS
${commands}
.SH FILES
.TP
.I boomfile.toml
The typed, validated TOML config at the root of your dotfiles repo.
.TP
.I ~/.local/state/boom/
Journal, backups, manifest, and breadcrumbs (honors \\fB$XDG_STATE_HOME\\fR).
.SH ENVIRONMENT
.TP
.B BOOM_CONFIG
Override the dotfiles repo boom resolves.
.TP
.B BOOM_OS, BOOM_HOST
Override the auto-detected OS / hostname used to gate sections.
.SH SEE ALSO
Full guide and source: https://github.com/alxjrvs/boom
`;
}

export const manCommand = buildCommand<Record<never, never>, [], BoomContext>({
  docs: { brief: "Emit the boom(1) man page (roff)" },
  parameters: {},
  func() {
    this.process.stdout.write(manPage(VERSION));
  },
});
