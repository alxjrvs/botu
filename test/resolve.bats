#!/usr/bin/env bats
# Config-repo resolution + the two breadcrumbs + botuinit.sh generation.
# Resolution order: $BOTU_CONFIG → breadcrumb → $PWD → ~/dotFiles.

load helper

setup() {
  botu_setup
  write_botufile <<'EOF'
section "test"
link payload ~/.payload
EOF
  printf 'hi\n' > "$CONFIG/payload"
}
teardown() { botu_teardown; }

@test "init refuses a dir with no botufile" {
  run botu init "$SANDBOX/home"
  [ "$status" -eq 1 ]
  [[ "$output" == *"no \`botufile\`"* ]]
}

@test "init records the repo breadcrumb" {
  run botu init "$CONFIG"
  [ "$status" -eq 0 ]
  [ "$(cat "$(crumb_config)")" = "$CONFIG" ]
}

@test "init generates an executable botuinit.sh that points back at the repo" {
  botu init "$CONFIG"
  [ -x "$CONFIG/botuinit.sh" ]
  grep -q 'botu init "$REPO"' "$CONFIG/botuinit.sh"
  grep -q 'botu apply' "$CONFIG/botuinit.sh"
}

@test "verbs use the recorded breadcrumb (no flags needed)" {
  botu init "$CONFIG"
  run botu apply # resolves the repo purely from the breadcrumb
  [ "$status" -eq 0 ]
  [ "$(readlink "$HOME/.payload")" = "$CONFIG/payload" ]
}

@test "BOTU_CONFIG env overrides the breadcrumb" {
  # Breadcrumb points at a decoy with a botufile; env points at the real repo.
  # If env didn't win, apply would link the decoy's payload instead.
  mkdir -p "$SANDBOX/decoy"
  printf 'section x\n' > "$SANDBOX/decoy/botufile"
  mkdir -p "$(dirname "$(crumb_config)")"
  printf '%s\n' "$SANDBOX/decoy" > "$(crumb_config)"
  BOTU_CONFIG="$CONFIG" run botu apply
  [ "$status" -eq 0 ]
  [ "$(readlink "$HOME/.payload")" = "$CONFIG/payload" ]
}

@test "falls back to \$PWD when no breadcrumb is set" {
  cd "$CONFIG" # no breadcrumb, no env → resolution lands on $PWD
  run botu apply
  [ "$status" -eq 0 ]
  [ "$(readlink "$HOME/.payload")" = "$CONFIG/payload" ]
}

@test "reconcile verb without any config errors with guidance" {
  run botu verify
  [ "$status" -eq 1 ]
  [[ "$output" == *"no dotfiles repo found"* ]]
}
