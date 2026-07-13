# Devlog

Running, dated log of real decisions, dead ends, and context that doesn't
belong in a spec file or a single PR description. Newest entry on top.

Format: `## YYYY-MM-DD` heading, then short bullets. Add an entry whenever a
PR resolves something the spec left ambiguous, or whenever a direction gets
tried and abandoned — that's the whole point of this file existing.

---

## 2026-07-12

- Repo scaffolded: Cargo workspace (6 crates) + npm workspaces (3 packages +
  2 apps), CI (Rust fmt/clippy/test, JS lint/test/build), Cursor project
  rules, mock server with fixture data.
- Layout simplified from four regions (main/side/bottom/corner) to two
  (main, bottom). Side was dropped entirely; corner's freeform notes/doc-refs
  moved into bottom as a second tab ("Notes"), alongside the existing
  column-synced aggregate tab ("Aggregate"). Reasoning: side added a synced
  dimension (row height) without a strong enough use case to justify the
  extra rendering/sync complexity; corner's content didn't need its own
  region once tabs existed as a mechanism.
- Cell-editing restrictions (how far to constrain formula/cell editing vs.
  Excel's fully free-form model) intentionally left undecided — revisit once
  the formula engine and cross-region referencing actually exist and there's
  real usage to reason from, rather than guessing upfront.
- Name locked to **Gridyard**; license set to Apache-2.0 (patent grant,
  enterprise-adopter friendly, keeps an open-core split viable later).
- Project identity: this repo (`gridyard/gridyard`) is the reusable OSS
  grid/formula/workspace engine. The ERP product built on top of it is a
  separate, later project and does not live in this repo.
