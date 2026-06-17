#!/usr/bin/env bats
# The `on <verb> CMD` primitive: the inline imperative step. `on apply` fires on
# apply AND fix (fix = re-apply); `on verify` fires only on verify. A non-zero
# exit folds into the tally (so apply itself exits 1). Honors --only and --dry-run.

load helper

setup() {
  botu_setup
  export BOTU_CONFIG="$CONFIG"
}
teardown() { botu_teardown; }

@test "on apply: fires on apply" {
  write_botufile <<'EOF'
on apply touch "$HOME/.marker"
EOF
  run botu apply
  [ "$status" -eq 0 ]
  [ -f "$HOME/.marker" ]
}

@test "on apply: also fires on fix (fix = re-apply)" {
  write_botufile <<'EOF'
on apply touch "$HOME/.marker"
EOF
  run botu fix
  [ "$status" -eq 0 ]
  [ -f "$HOME/.marker" ]
}

@test "on apply: does NOT fire on verify" {
  write_botufile <<'EOF'
on apply touch "$HOME/.marker"
EOF
  run botu verify
  [ ! -e "$HOME/.marker" ]
}

@test "on verify: fires on verify, not on apply" {
  write_botufile <<'EOF'
on verify touch "$HOME/.marker"
EOF
  run botu apply
  [ ! -e "$HOME/.marker" ]
  run botu verify
  [ -f "$HOME/.marker" ]
}

@test "on apply: a non-zero exit folds into the tally (apply exits 1)" {
  write_botufile <<'EOF'
on apply false
EOF
  run botu apply
  [ "$status" -eq 1 ]
  [[ "$output" == *"false (exit 1)"* ]]
}

@test "on verify: a non-zero exit makes verify fail (exit 1)" {
  write_botufile <<'EOF'
on verify false
EOF
  run botu verify
  [ "$status" -eq 1 ]
}

@test "on: honors --only via the enclosing section" {
  write_botufile <<'EOF'
section "alpha"
on apply touch "$HOME/.in_alpha"
section "beta"
on apply touch "$HOME/.in_beta"
EOF
  run botu apply --only=alpha
  [ "$status" -eq 0 ]
  [ -f "$HOME/.in_alpha" ]
  [ ! -e "$HOME/.in_beta" ]
}

@test "on apply: --dry-run reports but runs nothing" {
  write_botufile <<'EOF'
on apply touch "$HOME/.marker"
EOF
  run botu apply --dry-run
  [ "$status" -eq 0 ]
  [ ! -e "$HOME/.marker" ]
  [[ "$output" == *"would run: touch"* ]]
}
