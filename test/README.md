# test/

`bats` suite for the engine. Every test is fully sandboxed via `helper.bash`: a
throwaway `$HOME` and `$XDG_STATE_HOME` per test, so breadcrumbs, symlinks, and
machine state never touch the real home.

Run them:

```sh
make test          # bats test/
bats test/dsl.bats # one file
```

| file            | covers                                                                      |
| --------------- | --------------------------------------------------------------------------- |
| `launcher.bats` | self-resolution through symlink chains, `--version`, `--help`, unknown-cmd  |
| `resolve.bats`  | config resolution order, breadcrumb, `botuinit.sh` generation               |
| `dsl.bats`      | `link`/`copy`/`glob`/`--mode` across apply/verify/fix, dry-run              |
| `verbs.bats`    | verify exit codes (0/2/1), `--only`, `update == apply --upgrade`            |
| `hooks.bats`    | hook contract (`_NAME_<verb>`, `$BOTU_k`, hyphen→underscore, scoping)        |
| `commands.bats` | command discovery (engine then config, precedence, +x gate)                 |
| `code.bats`     | `code` breadcrumb + repo crawl, independent of the dotfiles repo            |
| `hygiene.bats`  | built-in MCP secret-hygiene policy (`${VAR}` / token literals)              |
| `on.bats`       | `on <verb> CMD` — verb gating (apply also on fix), tally, `--only`/dry-run  |
| `uninstall.bats`| `uninstall` removes only botu-owned links/copies, then clears the manifest  |
| `lock.bats`     | concurrency lock — live pid blocks, dead pid reclaimed, verify/dry-run skip |
| `orphans.bats`  | orphan reaping + manifest — verify warns, fix/apply reap repo-only links    |

The mode test skips on non-macOS (the engine verifies perms with BSD `stat -Lf`).
