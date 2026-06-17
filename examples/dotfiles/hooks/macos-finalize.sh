#!/usr/bin/env bash
# hook: macos-finalize — the imperative tail after osx_default writes. (90-macos.sh)
_macos_finalize_apply() {
  [[ "$(os_kind)" == "darwin" ]] || return 0
  _hdr "macOS finalize"
  [[ "${DRY_RUN:-0}" == "1" ]] && {
    _note "would killall Dock Finder SystemUIServer"
    return 0
  }
  killall Dock Finder SystemUIServer > /dev/null 2>&1 || true
  _ok "restarted Dock/Finder/SystemUIServer"
}
_macos_finalize_verify() { return 0; } # nothing persistent to check
_macos_finalize_fix() { _macos_finalize_apply; }
