#!/usr/bin/env bash
# hook: ssh-perms — the perms `link --mode` can't set. (install/45-ssh.sh tail)
_ssh_perms_apply() {
  _hdr "SSH perms"
  [[ "${DRY_RUN:-0}" == "1" ]] && {
    _note "would chmod 700 ~/.ssh, mkdir ~/.ssh/cm"
    return 0
  }
  chmod 700 "$HOME/.ssh" 2> /dev/null || true
  mkdir -p "$HOME/.ssh/cm"
  chmod 700 "$HOME/.ssh/cm" 2> /dev/null || true
  _ok ".ssh and .ssh/cm set to 700"
}
_ssh_perms_verify() {
  _hdr "SSH perms"
  if [[ "$(stat -f '%Lp' "$HOME/.ssh" 2> /dev/null)" == "700" ]]; then _ok ".ssh is 700"; else _warn ".ssh perms not 700"; fi
}
_ssh_perms_fix() { _ssh_perms_apply; }
