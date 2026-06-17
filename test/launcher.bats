#!/usr/bin/env bats
# Launcher: self-resolution (the core invariant — find engine/ siblings no matter
# how botu is reached), version, help, and unknown-command behavior.

load helper

setup() { botu_setup; }
teardown() { botu_teardown; }

@test "--version prints the shipped VERSION" {
  run botu --version
  [ "$status" -eq 0 ]
  [ "$output" = "botu $(cat "$BOTU_ROOT/VERSION")" ]
}

@test "--help lists core verbs and discovered tools" {
  run botu --help
  [ "$status" -eq 0 ]
  [[ "$output" == *"usage: botu"* ]]
  [[ "$output" == *"code"* ]] # an engine-shipped command
}

@test "resolves engine/ when reached through a PATH symlink chain" {
  # Two hops: bin/botu → … → real engine/botu. A naive dirname would look beside
  # the link and miss engine/run; resolution must still find it.
  mkdir -p "$SANDBOX/bin" "$SANDBOX/more"
  ln -s "$BOTU" "$SANDBOX/bin/botu"
  ln -s "$SANDBOX/bin/botu" "$SANDBOX/more/botu"
  run "$SANDBOX/more/botu" info
  [ "$status" -eq 0 ]
  [[ "$output" == *"engine=$BOTU_ROOT/engine"* ]]
}

@test "resolves engine/ when invoked via a relative symlink" {
  ln -s "$BOTU" "$SANDBOX/botu"
  cd "$SANDBOX"
  run ./botu info
  [ "$status" -eq 0 ]
  [[ "$output" == *"engine=$BOTU_ROOT/engine"* ]]
}

@test "unknown subcommand exits 2 and lists what's available" {
  run botu nonesuch
  [ "$status" -eq 2 ]
  [[ "$output" == *"unknown subcommand: nonesuch"* ]]
  [[ "$output" == *"apply verify fix update"* ]]
}

@test "discovered command runs with no dotfiles repo configured" {
  run botu info
  [ "$status" -eq 0 ]
  [[ "$output" == *"engine-shipped tool"* ]]
}
