#!/usr/bin/env bats
# `botu code`: the workspace mirror. Records its own breadcrumb (independent of
# the dotfiles repo) and crawls git repos under the code dir (leaf rule).

load helper

setup() {
  botu_setup
  CODE="$SANDBOX/Code"
  mkdir -p "$CODE/repo-a/.git" "$CODE/group/repo-b/.git"
}
teardown() { botu_teardown; }

@test "code init records the code-dir breadcrumb" {
  run botu code init "$CODE"
  [ "$status" -eq 0 ]
  [ "$(cat "$(crumb_code)")" = "$CODE" ]
}

@test "code needs no dotfiles repo — runs from its own breadcrumb" {
  botu code init "$CODE"
  run botu code claude
  [ "$status" -eq 0 ]
  [[ "$output" == *"repo-a"* ]]
  [[ "$output" == *"group/repo-b"* ]]
}

@test "code errors with guidance when no code dir is known" {
  # Point resolution at an empty HOME with no ~/Code and no breadcrumb.
  run botu code claude
  [ "$status" -eq 1 ]
  [[ "$output" == *"no code dir"* ]]
}

@test "BOTU_CODE env overrides the breadcrumb" {
  BOTU_CODE="$CODE" run botu code cmux
  [ "$status" -eq 0 ]
  [[ "$output" == *"repo-a"* ]]
}
