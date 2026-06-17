# BoomTube — design spec

**BoomTube** is an **installable dotfiles + workspace engine**: a single
self-contained binary (executable: **`botu`**), compiled from **TypeScript on
Bun**, that reconciles a machine from a declarative `botufile.toml` and opens
portals to code workspaces. Named for Kirby's **Boom Tube** — it opens portals to
your machine's ideal state, and to your code.

It began as a bash prototype (extracted from `alxjrvs/dotFiles`) and was rewritten
to TypeScript; this document is the design of record for that engine.

## The model (decided — don't relitigate)

A `botu` invocation does one of two things:

1. **Reconcile verbs** over a config repo's `botufile.toml`:
   - `botu apply`  — make it so
   - `botu verify` — check drift, exit 0 ok / 2 warn / 1 fail (`--json` for a report)
   - `botu fix`    — repair drift (apply, overwriting conflicts)
   - `botu uninstall` / `botu update` (= apply with upgrades)
   These share **one verb-parameterized loop** (`src/engine/reconcile.ts`) over a
   resource-type registry — siblings, not separate scripts. `botu rollback` undoes
   the most recent apply; `apply --resume` continues an interrupted one.

2. **Discovered subcommands** — built-ins are the `@stricli` route map (`code`,
   `mcp`, `watchtower`, `where`, `migrate`, `rollback`); user commands resolve at
   runtime from `<config>/commands/<name>.ts`. Adding a tool never edits a
   dispatch table.

### Config is typed TOML, not code

`botufile.toml` is a TOML document validated against a schema (`src/config/schema.ts`,
valibot). It is grouped into `[[section]]`s; within a section, resources run in a
fixed phase order: `link → copy → glob → packages (brewfile/mise) → run → hook`.
Resources:

- `link` / `copy` `{ src, dst, mode? }`, `glob { pattern, into }`
- `brewfile = "FILE"`, `mise = true`
- `run = [{ on = "apply"|"verify", cmd }]` — the inline imperative escape
- `hook = [{ name, with? }]` — load `hooks/<name>.ts`, the TS resource-type extension

A section may carry `when = { os, host, profile }` to gate by machine; overlay
files `botufile.<os|host|profile>.toml` are merged onto the base. `--profile`
(repeatable) activates named profiles; os/host auto-match (overridable via
`BOTU_OS`/`BOTU_HOST`).

### Hooks = the resource-type extension contract

`hooks/<name>.ts` default-exports (or names) `apply`/`verify`/`fix`/`uninstall`
functions receiving a `HookApi`: `{ with, verb, dryRun, env, ok, warn, fail, note }`.
Loaded by runtime `import()` (works inside the compiled binary). This replaces the
bash `_NAME_<verb>` hooks and is the public extension point.

### Transaction + state

Mutating runs open a journal under `${XDG_STATE_HOME:-~/.local/state}/botu/journal/`
(NDJSON, intent/done + undo token, committed marker) and **back up** any displaced
file under `…/backups/<run-id>/`. `botu rollback` replays the journal in reverse
(remove created links, restore backups). A `manifest` of owned destinations drives
orphan reaping (verify warns; apply/fix reap). Breadcrumbs (`config`, `code`) record
the dotfiles repo and code dir.

## Stack

| Concern | Choice |
|---------|--------|
| CLI | `@stricli/core` — the only framework that compiles cleanly under `bun build --compile` |
| Config | TOML via `smol-toml`, validated by `valibot` |
| Shell / process | `Bun.$` / `Bun.spawnSync`; `node:fs/promises` for symlink/copy/mode |
| Output | `Bun.color` palette + a tally Reporter (drives exit codes) |
| Quality gates | Biome (lint + format), `tsc --noEmit`, `bun test` |
| Distribution | `bun build --compile` matrix (macOS arm64/x64, Linux x64) |

## Layout

```
src/
  cli.ts · index.ts        @stricli app + entrypoint (dispatch: mcp, user cmds, built-ins)
  commands/                init, apply/verify/fix/update/uninstall (reconcile.ts), where,
                           migrate, rollback, code, watchtower, mcp
  engine/
    reconcile.ts           the one verb loop
    registry.ts            per-section phase dispatch
    resources/             link · copy · glob · packages · run · hook
    journal.ts state.ts    transaction + on-disk state
    rollback.ts code.ts discovery.ts
  config/  schema.ts load.ts migrate.ts profile.ts
  lib/     reporter.ts color.ts fs.ts proc.ts version.ts
test/                       bun test (unit + sandboxed integration)
examples/dotfiles/          a runnable botufile.toml example
.github/workflows/          ci.yml (check + cross-compile smoke), release.yml (tag → matrix → attach)
```

## Distribution

`install.sh` downloads the matching binary from the GitHub release; `Formula/botu.rb`
installs it via Homebrew (the repo doubles as the tap). `release.yml` cross-compiles
the matrix on a tag and attaches the binaries + checksums. macOS code-signing is a
follow-up (the binaries run after a Gatekeeper prompt until then).
