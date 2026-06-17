#!/usr/bin/env bats
# Built-in verify-only policy: tracked .mcp.json/.env carry op:// references —
# never ${VAR} placeholders (Claude Code #18692) nor resolved token literals.

load helper

# Build the fake token at call time so this source file never carries a
# contiguous `ghp_…` literal — keeps secret-scanners off our own fixtures while
# the value written into the sandbox still trips the engine's `gh[opsu]_` regex.
fake_token() { printf 'ghp%sFAKEPLACEHOLDERTOKENvalue' '_'; }

setup() {
  botu_setup
  export BOTU_CONFIG="$CONFIG"
  write_botufile <<'EOF'
section "test"
EOF
  git -C "$CONFIG" init -q
}
teardown() { botu_teardown; }

@test "clean tracked .mcp.json with op:// refs passes" {
  printf '{ "k": "op://vault/item/field" }\n' > "$CONFIG/.mcp.json"
  git -C "$CONFIG" add .mcp.json
  run botu verify
  [ "$status" -eq 0 ]
  [[ "$output" == *"carry references only"* ]]
}

@test "a \${VAR} placeholder in tracked .mcp.json warns" {
  printf '{ "k": "${GITHUB_TOKEN}" }\n' > "$CONFIG/.mcp.json"
  git -C "$CONFIG" add .mcp.json
  run botu verify
  [ "$status" -eq 2 ]
  [[ "$output" == *"placeholder"* ]]
}

@test "a resolved token literal in a tracked .env fails" {
  printf 'TOKEN=%s\n' "$(fake_token)" > "$CONFIG/.env"
  git -C "$CONFIG" add .env
  run botu verify
  [ "$status" -eq 1 ]
  [[ "$output" == *"resolved-token literal"* ]]
}

@test "an untracked secret-bearing file is ignored (only tracked files checked)" {
  printf 'TOKEN=%s\n' "$(fake_token)" > "$CONFIG/.env" # not git-added
  run botu verify
  [ "$status" -eq 0 ]
}
