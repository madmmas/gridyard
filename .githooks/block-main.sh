#!/usr/bin/env bash
# Shared guard: refuse direct work on the protected default branch.
# Used by pre-commit (local branch) and pre-push (remote ref).
# Bypass in an emergency: SKIP_HOOKS=1

set -euo pipefail

if [ "${SKIP_HOOKS:-}" = "1" ]; then
  exit 0
fi

protected_branch="${GRIDYARD_PROTECTED_BRANCH:-main}"

block() {
  printf '\033[31m%s\033[0m\n' "$1"
  printf 'Create a feature branch: git checkout -b <topic>\n'
  printf 'Open a PR to merge into %s.\n' "$protected_branch"
  printf 'Emergency bypass (once): SKIP_HOOKS=1\n'
  exit 1
}
