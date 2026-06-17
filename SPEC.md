# botu — design spec & build brief

`botu` is an **installable dotfiles + workspace engine**, extracted from
[`alxjrvs/dotFiles`](https://github.com/alxjrvs/dotFiles). It lives on `PATH`
(brew / curl installer), and a user's dotfiles repo becomes *pure config* that
`botu` reconciles. Named for Jack Kirby's **Boom Tube** (the Fourth World
portal): `botu` opens portals — to your machine's ideal state, and to your code
workspaces.

This repo was seeded with a **working prototype** (`engine/`) and a runnable
example config (`examples/dotfiles/`). Your job: build it into the *proper*
engine. The prototype is the proof the model works end-to-end — keep its shape,
harden everything.

## The model (decided — don't relitigate)

A `botu` command does one of two things:

1. **Reconcile verbs** over a config repo's `botufile`:
   - `botu apply`  — make it so (was `dot sync`)
   - `botu verify` — check drift, exit 0/1/2 (was `dot doctor`)
   - `botu fix`    — repair drift (was `dot doctor --fix`)
   - `botu update` — `apply --upgrade`
   These share ONE loop, parameterized by verb (`engine/run`). `apply`/`verify`/
   `fix` are siblings, not separate scripts. This unification is the core win.

2. **Discovered subcommands** — two tiers, no hardcoded dispatch table:
   `engine/commands/<name>` (ships with botu) then `<config>/commands/<name>`
   (user's own). Adding a tool never edits the dispatcher.

### Config is a bash DSL, NOT JSON/jq

The `botufile` is a short bash program the engine sources once under a verb.
Each line is a verb-aware primitive that acts immediately. **No JSON, no jq, no
manifest parser** — this was tried (a `dot.json` + jq providers) and removed;
do not bring it back. jq-as-config is a non-goal.

Primitives (defined in `engine/run`):
`section`, `link [--mode M]`, `copy [--mode M]`, `glob PAT DIR`, `brewfile FILE`,
`mise_install`, `osx_default DOMAIN KEY TYPE VALUE`, `hook NAME [k=v ...]`.

Plus one always-on built-in verify: **MCP secret hygiene** (tracked
`.mcp.json`/`.env` carry `op://` refs, never `${VAR}` placeholders or
resolved-token literals — see dotFiles commit `b8067ab`).

### Hooks vs commands

- **hooks/** (in the *config* repo) = the imperative residue the DSL can't
  express. Each is `hooks/NAME.sh` exposing `_NAME_apply/_verify/_fix`, with
  `hook NAME k=v` data arriving as `$BOTU_k`. Seeded examples: `op-agent`,
  `claude`, `lefthook`, `ssh-perms`, `macos-finalize`.
- **commands/** = standalone tools you *invoke*. Generic ones ship in the engine
  (`code`, `mcp`, `watchtower`, `info`); truly personal ones live in the config
  repo's `commands/`.

### Two breadcrumbs, two inits

State lives under `${XDG_STATE_HOME:-~/.local/state}/botu/`:
- `botu init [PATH]` → records the **dotfiles repo** (`…/botu/config`). Also
  **generates `botuinit.sh`** in that repo — a one-command bootstrap (curl+install
  botu, `botu init`, `botu apply`) for fresh-machine clones.
- `botu code init [DIR]` → records the **code dir** (`…/botu/code`, default
  `~/Code`). Independent of the dotfiles repo — `botu code` needs no config.

Resolution order (config): `$BOTU_CONFIG` → breadcrumb → `$PWD` → `~/dotFiles`,
first dir containing a `botufile` wins.

## What "proper engine" means — your build list

Roughly priority order. Keep every step `shellcheck -x` + `shfmt -i 2 -ci -sr`
clean; this is a senior-engineer showpiece (the dotFiles ethos: *small, native,
legible, just bash + git*).

1. **Robust launcher resolution.** The installed `botu` must find its own
   `engine/` even when invoked via a PATH symlink. The original `dot` solved the
   sibling problem with a copy-not-symlink + a breadcrumb; decide the right
   mechanism (resolve symlinks, `libexec/`, or a wrapper) and make it bullet-proof.
2. **`install.sh`** — curl-able installer that puts `botu` on `PATH` and the
   engine somewhere stable; idempotent; uninstall path. Then a **brew formula/tap**.
3. **Real `code` backends.** `code claude` / `code cmux` currently print a plan.
   Port the actual logic from dotFiles `cmux/mirror` (`dot ws`): leaf-rule crawl
   (done), claude backend = one idle `claude --bg` per repo with coverage via
   `claude agents --json`; cmux backend = workspaces/groups/colors over the
   control socket. Honor `--prompt`, `--headless`, `--dry-run`, etc.
4. **Real `watchtower`** — port the op-based 1Password audit from dotFiles.
5. **`mcp`** — already ported from dotFiles `mcp/mcp`; verify + add tests.
6. **Tests** — `bats`, like dotFiles `test/`. Cover the DSL primitives
   (link/copy/glob/mode), verb dispatch, breadcrumb resolution, `botuinit.sh`
   generation, hook contract, command discovery. The sandbox pattern from the
   prototype (fake `$HOME` + fake config repo) works well.
7. **CI** — shellcheck + shfmt + bats on push/PR (mirror dotFiles `.github`).
8. **README + man/usage**, `--version`, `botu --help` per subcommand.
9. **Aliases** — consider `sync`→apply, `doctor`→verify for muscle memory
   (the prototype dropped them; decide).

## Downstream goal (not this repo, but the why)

Once `botu` is solid, **carve the dotFiles repo down to just config**: a
`botufile`, `hooks/`, payload (`.zshrc`, `zsh/`, `nvim/`, `dot-claude/`,
`Brewfile`, `mise.toml`, …) — deleting `dot`, `sync`, `doctor`, `lib/common.sh`,
`install/*.sh`, `watchtower`, `mcp/`, `cmux/`. That carve-out is the payoff;
build botu so it cleanly absorbs every one of those.

## Prototype map (your starting point)

```
engine/botu            dispatcher: init (+botuinit.sh) · lazy config · verbs · discovery
engine/run             reconcile core: sources botufile under a verb (the DSL host)
engine/lib.sh          engine helpers: palette, os_kind, _symlink
engine/commands/code   workspace mirror (init/claude/cmux) — was `dot ws`
engine/commands/mcp    op-native MCP registrar — ported from dotFiles mcp/mcp
engine/commands/watchtower  STUB — port the real audit
engine/commands/info   example engine tool (delete or repurpose)
examples/dotfiles/     a runnable sample config (botufile + the 5 hooks)
```

Run the prototype: `./engine/botu init examples/dotfiles && ./engine/botu verify`
(use a throwaway `$HOME`/`$XDG_STATE_HOME` to avoid touching your real machine).
