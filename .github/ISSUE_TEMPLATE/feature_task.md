---
name: Feature / spec task
about: A scoped slice of work tied to one of the docs/0X spec files
title: "[crate/package] Short description"
labels: []
assignees: []
---

## Spec reference

Which spec file and section this comes from, e.g. `docs/01-grid-engine-core-spec.md` §
Dependency graph and recalculation.

## Context

What this issue covers and why, in a sentence or two. Link any prior decisions
in `DEVLOG.md` that this builds on or changes.

## Scope

**In scope:**
-

**Out of scope:**
-

## Acceptance criteria

- [ ]
- [ ]
- [ ]

## Testing requirements

- [ ] Unit tests colocated per `.cursor/rules/030-testing.mdc` (Rust: `#[cfg(test)] mod tests`,
      table-driven where it fits; TS: `<file>.test.ts` via Vitest)
- [ ] `cargo fmt --check && cargo clippy -- -D warnings && cargo test --workspace` passes (if Rust)
- [ ] `npm test --workspaces --if-present` passes (if TS)

## Notes

Anything ambiguous in the spec that needs a decision before/during implementation —
resolve it here or flag it for `DEVLOG.md` once decided.
