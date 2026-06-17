#!/usr/bin/env bash
# hook: op-agent — provision the agent 1Password service account + cache the git
# PAT for least-privilege osxkeychain git auth. Ported from install/47-op-agent.sh.
# Data: vault=<name> keychain=<service>  → $BOTU_vault $BOTU_keychain
_op_agent_apply() {
  _hdr "1Password agent service account"
  local vault="${BOTU_vault:-claude-agent}" kc="${BOTU_keychain:-op-claude-agent}"
  command -v op > /dev/null 2>&1 || {
    _warn "op (1Password CLI) not installed — skipping"
    return 0
  }
  if [[ "${DRY_RUN:-0}" == "1" ]]; then
    _note "would ensure vault ${vault} + per-host SA + keychain token, cache git PAT"
    return 0
  fi
  if security find-generic-password -s "$kc" > /dev/null 2>&1; then
    _ok "service-account token present in keychain"
  else
    op vault list > /dev/null 2>&1 || {
      _warn "op not signed in — run from a regular terminal"
      return 0
    }
    op vault get "$vault" > /dev/null 2>&1 || op vault create "$vault" > /dev/null 2>&1 || {
      _warn "could not ensure vault ${vault}"
      return 0
    }
    local host sa token
    host="$(scutil --get LocalHostName 2> /dev/null || hostname -s)"
    sa="claude-agent-${host}"
    if token="$(op service-account create "$sa" --vault "${vault}:read_items" --raw 2> /dev/null)" && [[ -n "$token" ]]; then
      if security add-generic-password -U -a "$USER" -s "$kc" -w "$token" 2> /dev/null; then _ok "SA ${sa} created; token in keychain"; fi
    else _warn "service-account create failed (needs owner/admin token)"; fi
  fi
  # cache the fine-grained git PAT into the login keychain (osxkeychain helper)
  local pat
  if pat="$(op read "op://${vault}/Claude Git PAT/credential" 2> /dev/null)" && [[ -n "$pat" ]]; then
    printf 'protocol=https\nhost=github.com\nusername=x-access-token\npassword=%s\n\n' "$pat" |
      git credential-osxkeychain store 2> /dev/null && _ok "git PAT cached (github.com)"
  else _warn "'Claude Git PAT' not in ${vault} yet — agent git-over-HTTPS will fail until minted"; fi
}
_op_agent_verify() {
  _hdr "1Password agent service account"
  local kc="${BOTU_keychain:-op-claude-agent}"
  if security find-generic-password -s "$kc" > /dev/null 2>&1; then _ok "SA token in keychain (${kc})"; else _warn "SA token missing — run: botu apply --only=op-agent"; fi
}
_op_agent_fix() { _op_agent_apply; }
