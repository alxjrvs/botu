#!/usr/bin/env bats
# The config DSL primitives: link, copy, glob, mode — across apply/verify/fix.

load helper

setup() {
  botu_setup
  export BOTU_CONFIG="$CONFIG"
}
teardown() { botu_teardown; }

@test "link: apply creates the symlink, verify passes" {
  printf 'zsh\n' > "$CONFIG/zshrc"
  write_botufile <<'EOF'
link zshrc ~/.zshrc
EOF
  run botu apply
  [ "$status" -eq 0 ]
  [ "$(readlink "$HOME/.zshrc")" = "$CONFIG/zshrc" ]
  run botu verify
  [ "$status" -eq 0 ]
}

@test "link: verify fails (exit 1) when the link is missing" {
  printf 'zsh\n' > "$CONFIG/zshrc"
  write_botufile <<'EOF'
link zshrc ~/.zshrc
EOF
  run botu verify
  [ "$status" -eq 1 ]
  [[ "$output" == *"not linked"* ]]
}

@test "fix: overwrites a conflicting real file" {
  printf 'repo\n' > "$CONFIG/zshrc"
  printf 'stale\n' > "$HOME/.zshrc" # a real file squatting the destination
  write_botufile <<'EOF'
link zshrc ~/.zshrc
EOF
  run botu fix
  [ "$status" -eq 0 ]
  [ "$(readlink "$HOME/.zshrc")" = "$CONFIG/zshrc" ]
}

@test "copy: installs a real copy (not a symlink), verify tracks it" {
  printf 'tool\n' > "$CONFIG/bin-tool"
  write_botufile <<'EOF'
copy bin-tool ~/.local/bin/tool
EOF
  run botu apply
  [ "$status" -eq 0 ]
  [ -f "$HOME/.local/bin/tool" ]
  [ ! -L "$HOME/.local/bin/tool" ]
  run botu verify
  [ "$status" -eq 0 ]
}

@test "glob: links every match into the destination dir, keeping names" {
  mkdir -p "$CONFIG/zsh"
  printf '1\n' > "$CONFIG/zsh/10-a.zsh"
  printf '2\n' > "$CONFIG/zsh/20-b.zsh"
  printf 'x\n' > "$CONFIG/zsh/notes.txt" # must NOT match the numeric pattern
  write_botufile <<'EOF'
glob 'zsh/[0-9]*.zsh' ~/.config/zsh/
EOF
  run botu apply
  [ "$status" -eq 0 ]
  [ "$(readlink "$HOME/.config/zsh/10-a.zsh")" = "$CONFIG/zsh/10-a.zsh" ]
  [ "$(readlink "$HOME/.config/zsh/20-b.zsh")" = "$CONFIG/zsh/20-b.zsh" ]
  [ ! -e "$HOME/.config/zsh/notes.txt" ]
}

@test "link --mode: applies and verifies destination permissions" {
  [ "$(uname -s)" = "Darwin" ] || skip "mode verify uses BSD stat (macOS)"
  printf 'secret\n' > "$CONFIG/sshconfig"
  write_botufile <<'EOF'
link --mode 600 sshconfig ~/.ssh/config
EOF
  run botu apply
  [ "$status" -eq 0 ]
  [ "$(stat -Lf '%Lp' "$HOME/.ssh/config")" = "600" ]
  run botu verify
  [ "$status" -eq 0 ]
  [[ "$output" == *"mode 600"* ]]
}

@test "dry-run changes nothing" {
  printf 'zsh\n' > "$CONFIG/zshrc"
  write_botufile <<'EOF'
link zshrc ~/.zshrc
EOF
  run botu apply --dry-run
  [ "$status" -eq 0 ]
  [ ! -e "$HOME/.zshrc" ]
}
