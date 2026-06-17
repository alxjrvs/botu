#!/usr/bin/env sh
# install.sh — put `botu` on PATH. Idempotent; re-runnable to upgrade.
#
# Two paths, auto-detected:
#   • from a checkout    ./install.sh                 (installs the tree you cloned)
#   • via curl | sh      curl -fsSL …/install.sh | sh (downloads the ref tarball)
#
# Layout (PREFIX defaults to ~/.local, override with BOTU_PREFIX):
#   $PREFIX/share/botu/engine/…   the engine (run/lib/commands)
#   $PREFIX/share/botu/VERSION    version marker (read by `botu --version`)
#   $PREFIX/bin/botu  →  …/share/botu/engine/botu   (symlink)
#
# The launcher resolves its own real path through the symlink chain, so the
# link's location is irrelevant — that's why a bare symlink (not a copy or a
# baked-path wrapper) is enough. Uninstall: ./install.sh --uninstall
set -eu

REPO_SLUG="${BOTU_REPO:-alxjrvs/botu}"
REF="${BOTU_REF:-main}"
PREFIX="${BOTU_PREFIX:-$HOME/.local}"
SHARE_ROOT="$PREFIX/share/botu"
ENGINE_DST="$SHARE_ROOT/engine"
BIN="$PREFIX/bin"
LINK="$BIN/botu"

log() { printf 'botu-install: %s\n' "$*"; }
die() {
  printf 'botu-install: %s\n' "$*" >&2
  exit 1
}

if [ "${1:-}" = "--uninstall" ]; then
  rm -f "$LINK"
  rm -rf "$SHARE_ROOT"
  log "removed $LINK and $SHARE_ROOT (breadcrumbs under XDG_STATE_HOME are left intact)"
  exit 0
fi

# ── Locate a source tree containing engine/ ───────────────────────────────────
# Prefer the checkout the script lives in; piped via curl the script has no dir
# on disk ($0 is "sh"), so fall back to downloading the ref tarball.
SRC=""
case "$0" in
  */*)
    self_dir="$(cd "$(dirname "$0")" && pwd)"
    [ -d "$self_dir/engine" ] && SRC="$self_dir"
    ;;
esac

if [ -n "$SRC" ]; then
  log "installing from checkout: $SRC"
else
  command -v curl > /dev/null 2>&1 || die "curl is required to download botu"
  command -v tar > /dev/null 2>&1 || die "tar is required to unpack botu"
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT INT TERM
  log "downloading $REPO_SLUG@$REF…"
  curl -fsSL "https://codeload.github.com/$REPO_SLUG/tar.gz/$REF" | tar -xzf - -C "$TMP"
  # GitHub names the extracted dir <repo>-<ref>; take the first that has engine/.
  for d in "$TMP"/*/; do
    [ -d "$d/engine" ] && SRC="${d%/}" && break
  done
  [ -n "$SRC" ] || die "downloaded archive had no engine/ tree"
fi

# ── Install ───────────────────────────────────────────────────────────────────
mkdir -p "$SHARE_ROOT" "$BIN"
rm -rf "$ENGINE_DST" # clean swap so removed engine files don't linger on upgrade
cp -R "$SRC/engine" "$ENGINE_DST"
[ -f "$SRC/VERSION" ] && cp "$SRC/VERSION" "$SHARE_ROOT/VERSION"
chmod +x "$ENGINE_DST/botu" "$ENGINE_DST/run" 2> /dev/null || true
find "$ENGINE_DST/commands" -type f -exec chmod +x {} + 2> /dev/null || true

ln -sf "$ENGINE_DST/botu" "$LINK"

log "installed botu $(cat "$SHARE_ROOT/VERSION" 2> /dev/null || echo '?') → $LINK"
log "engine → $ENGINE_DST"
case ":$PATH:" in
  *":$BIN:"*) ;;
  *) log "NOTE: $BIN is not on PATH — add:  export PATH=\"$BIN:\$PATH\"" ;;
esac
log "next: botu init /path/to/dotfiles && botu apply"
