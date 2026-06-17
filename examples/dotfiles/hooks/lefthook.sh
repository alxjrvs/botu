#!/usr/bin/env bash
# hook: lefthook — install the git hooks. (install/85-lefthook.sh)
_lefthook_apply() {
  _hdr "lefthook"
  command -v lefthook > /dev/null 2>&1 || {
    _warn "lefthook not installed"
    return 0
  }
  [[ "${DRY_RUN:-0}" == "1" ]] && {
    _note "would run: lefthook install"
    return 0
  }
  (cd "$BOTU_CONFIG" && lefthook install) > /dev/null 2>&1 && _ok "git hooks installed"
}
_lefthook_verify() {
  _hdr "lefthook"
  if [[ -f "$BOTU_CONFIG/.git/hooks/pre-commit" ]]; then _ok "pre-commit hook present"; else _warn "hooks not installed"; fi
}
_lefthook_fix() { _lefthook_apply; }
