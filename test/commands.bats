#!/usr/bin/env bats
# Command discovery: engine/commands then <config>/commands, no hardcoded table.
# Engine ships generic tools; the config repo can add its own; engine wins ties.

load helper

setup() {
  botu_setup
  write_botufile <<'EOF'
section "test"
EOF
  export BOTU_CONFIG="$CONFIG"
  mkdir -p "$CONFIG/commands"
}
teardown() { botu_teardown; }

@test "engine-shipped command is discovered" {
  run botu info
  [ "$status" -eq 0 ]
  [[ "$output" == *"engine-shipped tool"* ]]
}

@test "config-supplied command is discovered" {
  cat > "$CONFIG/commands/hello" <<'EOF'
#!/usr/bin/env bash
echo "hello from config"
EOF
  chmod +x "$CONFIG/commands/hello"
  run botu hello
  [ "$status" -eq 0 ]
  [[ "$output" == *"hello from config"* ]]
}

@test "engine command takes precedence over a same-named config command" {
  cat > "$CONFIG/commands/info" <<'EOF'
#!/usr/bin/env bash
echo "config override"
EOF
  chmod +x "$CONFIG/commands/info"
  run botu info
  [ "$status" -eq 0 ]
  [[ "$output" == *"engine-shipped tool"* ]]
  [[ "$output" != *"config override"* ]]
}

@test "a non-executable file in commands/ is not dispatched" {
  printf 'echo nope\n' > "$CONFIG/commands/inert" # no +x
  run botu inert
  [ "$status" -eq 2 ]
  [[ "$output" == *"unknown subcommand"* ]]
}
