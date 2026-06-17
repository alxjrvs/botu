# CLAUDE.md — botu

## What this is

`botu` is an installable dotfiles + workspace engine extracted from
`alxjrvs/dotFiles`. Read [`SPEC.md`](SPEC.md) first — it's the design of record
and the build plan. The `engine/` dir is a working prototype proving the model;
your job is to build it into the proper, installable tool.

## North stars (inherited from dotFiles)

1. **Native over special.** Stock tools, minimal ceremony. Deleting custom code
   in favor of a built-in is the highest-value change.
2. **Just bash + git.** No runtime deps for the engine. **Config is a bash DSL,
   never JSON/jq** — jq-as-config was tried and removed; do not reintroduce it.
3. **Legible showpiece.** Small, exemplary, senior-engineer quality. Comments
   explain the *decision and the gotcha*, not the *what*.
4. **One model, two surfaces.** `apply`/`verify`/`fix` are one verb-parameterized
   loop. Subcommands are *discovered* (`engine/commands` then `<config>/commands`),
   never a growing hardcoded dispatch table.

## Conventions

- Every shell file must pass `shellcheck -x` and `shfmt -i 2 -ci -sr`.
- Tests in `bats` (see SPEC step 6); sandbox with a throwaway `$HOME` +
  `$XDG_STATE_HOME` so tests never touch the real machine.
- Hooks expose `_NAME_apply/_verify/_fix` and read data from `$BOTU_<key>`.
- State (breadcrumbs) under `${XDG_STATE_HOME:-~/.local/state}/botu/`.
- Commit messages: `type(scope): summary`. End with the co-author trailer.

## Don't

- Don't reintroduce a JSON manifest or any jq-based config parsing.
- Don't add a hardcoded subcommand case for tools — use command discovery.
- Don't let `verify`/`apply`/`fix` drift into separate scripts — one loop.
