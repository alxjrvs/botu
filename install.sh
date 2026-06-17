#!/usr/bin/env sh
# install.sh — install botu onto PATH. SKELETON — see SPEC.md step 1–2.
#
# TODO (build): make the launcher resolution bullet-proof when invoked via a
# PATH symlink (the engine/ siblings must be found). Decide: resolve symlinks in
# the launcher, install to a libexec dir + a thin bin shim, or copy. Then ship a
# brew tap/formula. For now this is a placeholder that documents the intent.
set -eu

PREFIX="${BOTU_PREFIX:-$HOME/.local}"
SHARE="$PREFIX/share/botu"
BIN="$PREFIX/bin"

SRC="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$SHARE" "$BIN"
cp -R "$SRC/engine" "$SHARE/engine"

# Thin launcher that points at the installed engine (resolution TODO — this naive
# version assumes $SHARE is stable).
cat > "$BIN/botu" << EOF
#!/usr/bin/env bash
exec "$SHARE/engine/botu" "\$@"
EOF
chmod +x "$BIN/botu"

echo "botu installed → $BIN/botu (engine at $SHARE/engine)"
echo "ensure $BIN is on PATH, then: botu init /path/to/dotfiles && botu apply"
