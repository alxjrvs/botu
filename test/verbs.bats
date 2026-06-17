#!/usr/bin/env bats
# Verb behavior: verify exit-code contract (0 ok / 2 warn / 1 fail), --only
# section filtering, and update == apply --upgrade.

load helper

setup() {
  botu_setup
  export BOTU_CONFIG="$CONFIG"
}
teardown() { botu_teardown; }

@test "verify exits 0 when everything is in place" {
  printf 'x\n' > "$CONFIG/f"
  write_botufile <<'EOF'
link f ~/.f
EOF
  botu apply
  run botu verify
  [ "$status" -eq 0 ]
  [[ "$output" == *"all checks passed"* ]]
}

@test "verify exits 1 on a hard failure (missing link)" {
  printf 'x\n' > "$CONFIG/f"
  write_botufile <<'EOF'
link f ~/.f
EOF
  run botu verify
  [ "$status" -eq 1 ]
}

@test "verify exits 2 on a warning (stale copy)" {
  printf 'v1\n' > "$CONFIG/f"
  write_botufile <<'EOF'
copy f ~/.f
EOF
  printf 'old\n' > "$HOME/.f" # present but not matching → warn, not fail
  run botu verify
  [ "$status" -eq 2 ]
}

@test "--only runs just the named section" {
  printf 'a\n' > "$CONFIG/a"
  printf 'b\n' > "$CONFIG/b"
  write_botufile <<'EOF'
section "alpha"
link a ~/.a
section "beta"
link b ~/.b
EOF
  run botu apply --only=alpha
  [ "$status" -eq 0 ]
  [ -L "$HOME/.a" ]
  [ ! -e "$HOME/.b" ]
}

@test "update reconciles like apply (apply --upgrade)" {
  printf 'x\n' > "$CONFIG/f"
  write_botufile <<'EOF'
link f ~/.f
EOF
  run botu update
  [ "$status" -eq 0 ]
  [ "$(readlink "$HOME/.f")" = "$CONFIG/f" ]
}
