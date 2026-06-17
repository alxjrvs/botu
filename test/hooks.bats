#!/usr/bin/env bats
# The hook contract: hooks/NAME.sh exposes _NAME_<verb>, k=v data arrives as
# $BOTU_k, hyphenated names map to underscored functions, missing files warn.

load helper

setup() {
  botu_setup
  export BOTU_CONFIG="$CONFIG"
  mkdir -p "$CONFIG/hooks"
}
teardown() { botu_teardown; }

@test "hook runs _NAME_<verb> and receives k=v as \$BOTU_k" {
  cat > "$CONFIG/hooks/greet.sh" <<'EOF'
_greet_apply() { _ok "hello ${BOTU_who}"; }
EOF
  write_botufile <<'EOF'
hook greet who=world
EOF
  run botu apply
  [ "$status" -eq 0 ]
  [[ "$output" == *"hello world"* ]]
}

@test "hook dispatches the verb-specific function" {
  cat > "$CONFIG/hooks/multi.sh" <<'EOF'
_multi_apply() { _ok "applied"; }
_multi_verify() { _ok "verified"; }
EOF
  write_botufile <<'EOF'
hook multi
EOF
  run botu verify
  [[ "$output" == *"verified"* ]]
  [[ "$output" != *"applied"* ]]
}

@test "hyphenated hook name maps to an underscored function" {
  cat > "$CONFIG/hooks/op-agent.sh" <<'EOF'
_op_agent_apply() { _ok "op-agent ran"; }
EOF
  write_botufile <<'EOF'
hook op-agent
EOF
  run botu apply
  [[ "$output" == *"op-agent ran"* ]]
}

@test "missing hook file warns (verify exits 2)" {
  write_botufile <<'EOF'
hook absent
EOF
  run botu verify
  [ "$status" -eq 2 ]
  [[ "$output" == *"hook absent: missing"* ]]
}

@test "\$BOTU_k is scoped to the hook, not leaked afterward" {
  cat > "$CONFIG/hooks/probe.sh" <<'EOF'
_probe_apply() { _ok "k=${BOTU_k:-unset}"; }
EOF
  cat > "$CONFIG/hooks/after.sh" <<'EOF'
_after_apply() { _ok "after=${BOTU_k:-unset}"; }
EOF
  write_botufile <<'EOF'
hook probe k=value
hook after
EOF
  run botu apply
  [[ "$output" == *"k=value"* ]]
  [[ "$output" == *"after=unset"* ]] # the pair was unset after the probe hook
}
