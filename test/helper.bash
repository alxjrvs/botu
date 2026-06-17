#!/usr/bin/env bash
# Shared bats harness. Every test runs fully sandboxed: a throwaway $HOME and
# $XDG_STATE_HOME mean breadcrumbs, symlinks, and machine state never touch the
# real home. Source this from each .bats file and call botu_setup/botu_teardown
# from its setup()/teardown().

BOTU_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BOTU="$BOTU_ROOT/engine/botu"

botu_setup() {
  SANDBOX="$(mktemp -d "${BATS_TMPDIR:-/tmp}/botu.XXXXXX")"
  export HOME="$SANDBOX/home"
  export XDG_STATE_HOME="$SANDBOX/state"
  mkdir -p "$HOME" "$XDG_STATE_HOME"
  # Inherited env must never leak a real config/code dir into the sandbox.
  unset BOTU_CONFIG BOTU_CODE BOTU_PREFIX
  CONFIG="$SANDBOX/dotfiles"
  mkdir -p "$CONFIG"
}

botu_teardown() {
  [[ -n "${SANDBOX:-}" && -d "$SANDBOX" ]] && rm -rf "$SANDBOX"
}

# botu … — invoke the entrypoint under test (the engine's, not any installed one)
botu() { "$BOTU" "$@"; }

# write_botufile — pipe a heredoc body into $CONFIG/botufile
write_botufile() { cat > "$CONFIG/botufile"; }

# crumb_config / crumb_code — paths to the two breadcrumbs, for assertions
crumb_config() { printf '%s/botu/config' "$XDG_STATE_HOME"; }
crumb_code() { printf '%s/botu/code' "$XDG_STATE_HOME"; }
