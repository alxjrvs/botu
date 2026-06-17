#!/usr/bin/env bash
# engine/lib.sh — the ENGINE's own helpers (palette, os_kind, _symlink).
#
# In the extracted universe this ships WITH botu, not with the config repo — so
# the config repo no longer carries a lib/common.sh. Sourced by engine/run.
# _symlink is the one mutation that deletes at the destination, kept here as a
# single source of truth (this is the former lib/common.sh link(), renamed so
# the config DSL can expose a clean `link` verb of its own).

# ── Output palette ────────────────────────────────────────────────────────────
_p_hdr() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
_p_ok() { printf '\033[0;32m  \xe2\x9c\x93 %s\033[0m\n' "$*"; }
_p_warn() { printf '\033[0;33m  \xe2\x86\x92 %s\033[0m\n' "$*"; }
_p_fail() { printf '\033[0;31m  \xe2\x9c\x97 %s\033[0m\n' "$*" >&2; }
_p_note() { printf '    %s\n' "$*"; }
_hdr() { _p_hdr "$@"; }
_ok() { _p_ok "$@"; }
_note() { _p_note "$@"; }
# _warn/_fail are re-wrapped by run to tally for the verify exit code.

os_kind() {
  case "$(uname -s)" in
    Darwin) printf 'darwin\n' ;;
    Linux) printf 'linux\n' ;;
    *) printf 'unknown\n' ;;
  esac
}

# _symlink SRC DST: idempotent symlink with LINK_MODE conflict handling and
# DRY_RUN support. Unchanged semantics from the legacy link().
_symlink() {
  local src="$1" dst="$2" label="${2#"${HOME}"/}"
  if [[ -L "$dst" && "$(readlink "$dst" 2> /dev/null || true)" == "$src" ]]; then
    printf '\033[2m  - %s already linked\033[0m\n' "$label"
    return 0
  fi
  if [[ "${DRY_RUN:-0}" == "1" ]]; then
    printf '\033[0;36m  ~ %s would be linked\033[0m\n' "$label"
    return 0
  fi
  if [[ ! -e "$dst" && ! -L "$dst" ]]; then
    mkdir -p "$(dirname "$dst")"
    ln -s "$src" "$dst"
    printf '\033[0;33m  \xe2\x86\x92 %s linked\033[0m\n' "$label"
    return 0
  fi
  printf '\033[0;31m  \xe2\x9c\x97 %s exists but is not our symlink\033[0m\n' "$label" >&2
  local choice
  case "${LINK_MODE:-interactive}" in
    overwrite) choice="o" ;;
    skip) choice="s" ;;
    *) [[ -t 0 ]] && read -rp "       overwrite? [o/s]: " choice || choice="s" ;;
  esac
  case "$choice" in
    o*) rm -rf -- "$dst" && ln -s "$src" "$dst" && printf '\033[0;33m  \xe2\x86\x92 %s overwritten\033[0m\n' "$label" ;;
    *) printf '\033[0;32m  \xe2\x9c\x93 %s skipped\033[0m\n' "$label" ;;
  esac
}
