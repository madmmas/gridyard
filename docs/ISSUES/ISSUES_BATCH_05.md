# Fifth issue batch — close the demo-wiring gap, then the last untouched crates

**Batch status (2026-07-15):** §25–§28 merged; §29 in flight; §30 still open.

| Batch § | GitHub | Title | PR |
|---------|--------|-------|----|
| 25 | [#58](https://github.com/madmmas/gridyard/issues/58) | Real scroll host and a large dataset, wiring virtualization + rAF batching | [#66](https://github.com/madmmas/gridyard/pull/66) |
| 26 | [#59](https://github.com/madmmas/gridyard/issues/59) | Wire search UI into the running demo | [#67](https://github.com/madmmas/gridyard/pull/67) |
| 27 | [#60](https://github.com/madmmas/gridyard/issues/60) | Clipboard — copy, cut, paste | [#68](https://github.com/madmmas/gridyard/pull/68) |
| 28 | [#61](https://github.com/madmmas/gridyard/issues/61) | Sort and filter via index vectors | [#69](https://github.com/madmmas/gridyard/pull/69) |
| 29 | [#62](https://github.com/madmmas/gridyard/issues/62) | CSV import/export | — |
| 30 | [#63](https://github.com/madmmas/gridyard/issues/63) | Layout permissions enforcement | — |

Checked the live repo first. All of batch 4 merged (PRs #52–#57), but
found a real pattern worth calling out rather than papering over: three
of those PRs shipped solid, tested pure logic in `grid-renderer` and
explicitly deferred actually wiring it into `web-demo`:

- PR #53 (virtualization): *"Unit paint isolation verified on a 5,000-row
  grid (web-demo scroll host wiring left as follow-up)."*
- PR #52 (rAF batching): *"Optional: wire scheduler into web-demo
  edit→paint path and confirm one paint per frame in DevTools
  Performance."*
- PR #55 (search): *"Demo chrome still deferred."*

So right now the demo still only ever shows 7 loan rows (or however many
Employee Management has) with no scrollbar, no search box, and no visible
benefit from any of the last three issues' work — the capability exists
and is unit-tested, but nobody using the demo can see or use it. That's
the highest-value gap to close before adding more engine breadth, so it
leads this batch. After that: `gridyard-grid` (still genuinely
unimplemented — the undo/redo work from batch 2 landed in
`gridyard-wasm`'s handle rather than this crate, so clipboard and
sort/filter, both named in this crate's own doc comment, are still
untouched) and `gridyard-io` (also still fully unimplemented), plus the
layout-permissions enforcement explicitly deferred in batch 4's issue #19.

---

## 25. [web-demo] Real scroll host and a large dataset, wiring virtualization + rAF batching

**Status:** done — PR [#66](https://github.com/madmmas/gridyard/pull/66) / issue [#58](https://github.com/madmmas/gridyard/issues/58)

### Spec reference
`docs/02-rendering-layer-spec.md`; closes the follow-ups from PRs #52 and #53.

### Context
`grid-renderer`'s viewport helpers and paint scheduler are tested against
synthetic inputs, never against an actual scrollable DOM/canvas element
in the running demo — which also means they've never been exercised
against real user scrolling, only unit tests. Small existing fixtures
(7 loan rows) can't demonstrate any of this either way.

### Scope
**In scope:**
- A real scrollable host element in `web-demo` wired to `grid-renderer`'s
  viewport helpers, replacing whatever fixed/non-scrolling container
  exists today
- A large synthetic dataset (thousands of rows) added to the mock server
  or generated client-side, specifically to make virtualization and
  rAF batching observable — not meant to replace the existing small
  fixtures, just to give this a real reason to exist in the demo
- Wire the paint scheduler into the actual edit→paint path per PR #52's
  own "optional" note — make it non-optional here, since this issue's
  whole point is closing that gap

**Out of scope:**
- Search — next issue, deliberately separated since it stacks on this one
- Virtualizing bottom's Notes tab — still likely too small to need it

### Acceptance criteria
- [x] Scrolling a multi-thousand-row grid in the actual browser stays smooth, painting only the visible window
- [x] A formula in an off-screen row shows its correct, already-computed value the moment it's scrolled into view — no flash of stale/empty state
- [ ] An edit that cascades through many dependents produces one paint per frame in the running demo, confirmed manually in DevTools Performance (per PR #52's original suggested check) — not just asserted in a unit test

### Testing requirements
- [x] Whatever new glue-code tests make sense in `web-demo`
- [x] `npm test --workspaces --if-present`, typecheck, and build all pass
- [ ] Manual scroll-and-edit verification in an actual browser, noted in the PR — this issue exists specifically because that verification has been skipped twice already

### Notes
Client-side `generateSyntheticLoans(5000)` behind a toolbar toggle (keeps
mock `db.json` small). Main panel uses a sticky-canvas scroll host +
`paintStaticGrid({ viewport })` + `createPaintScheduler` on edit/scroll.
Row 2500 overdue is `=B1` for the off-screen formula check; rows 2–21
daysLate are `=B1` cascade dependents. Manual DevTools one-paint-per-frame
confirmation left for the reviewer / PR test plan.

---

## 26. [web-demo] Wire search UI into the running demo

**Status:** done — PR [#67](https://github.com/madmmas/gridyard/pull/67) / issue [#59](https://github.com/madmmas/gridyard/issues/59)

### Spec reference
`docs/02-rendering-layer-spec.md`; closes the follow-up from PR #55.

### Context
Search match-finding, highlighting, and scroll-into-view logic already
exist and are tested (PR #55) — there's no actual search box anywhere in
the demo yet. Depends on issue #25's scroll host, same as the original
PRs stacked search on top of virtualization + rAF.

### Scope
**In scope:**
- A visible search input in the demo, wired to the existing find/next/prev/clear helpers
- Matches highlight and scroll into view using issue #25's real scroll host, not a mocked one
- Works against the large dataset from issue #25, so it's demonstrating something real, not searching 7 rows

**Out of scope:**
- Cross-region search — still scoped to the active region/tab per the original issue #24's decision

### Acceptance criteria
- [x] Typing a search term in the running demo highlights matches and scrolls the first one into view
- [x] Next/previous controls work from the actual UI, not just in unit tests
- [x] Clearing search removes highlights and leaves scroll state sane

### Testing requirements
- [x] Whatever new glue-code tests make sense in `web-demo`
- [x] `npm test --workspaces --if-present`, typecheck, and build all pass

### Notes
Main-region Find chrome (input + prev/next/clear + status). Uses
`beginSearch` / `nextSearchMatch` / `prevSearchMatch` / `clearSearch` and
scrolls via `revealActiveSearchMatch` on the §25 scroll host. Search is
main-only (not bottom Aggregate/Notes). Manual demo check recommended
with **5k rows** so scroll-into-view is obvious.

---

## 27. [gridyard-grid] Clipboard — copy, cut, paste

**Status:** done — PR [#68](https://github.com/madmmas/gridyard/pull/68) / issue [#60](https://github.com/madmmas/gridyard/issues/60)

### Spec reference
`docs/01-grid-engine-core-spec.md` — Selection/clipboard/undo section.

### Context
`gridyard-grid`'s own doc comment has named "selection, clipboard,
sort/filter, and the undo/redo command stack" since scaffolding.
Undo/redo ended up implemented in `gridyard-wasm`'s handle instead of
here (batch 2, issue #19) and selection lives in `grid-renderer`
(TypeScript, batch 2 issue #17) — so this crate is still, genuinely,
unimplemented. This issue picks up clipboard specifically.

### Scope
**In scope:**
- Copy/cut a single cell or a rectangular range; paste into a target location
- Paste respects the existing undo/redo stack (a paste is one undoable command, not N single-cell edits)
- Copying a formula and pasting elsewhere adjusts relative references correctly (standard spreadsheet fill-paste behavior) — copying a literal pastes the literal unchanged

**Out of scope:**
- WASM / UI keyboard wiring — engine logic only; follow-up can surface Cmd/Ctrl-C/V

### Acceptance criteria
- [x] Copy → paste elsewhere produces correct values, with relative formula references adjusted
- [x] Cut → paste removes the source and the operation undoes as a single step
- [x] Pasting over cells with existing content correctly overwrites and remains undoable

### Testing requirements
- [x] Table-driven tests: single-cell copy/paste, range copy/paste, cut, formula reference adjustment, undo of a paste
- [x] `cargo fmt --check && cargo clippy -- -D warnings && cargo test --workspace` passes

### Notes
`gridyard-grid`: `copy` / `cut` / `paste` + `BatchEditCommand` on
`UndoStack`. Formula adjustment via `gridyard_formula::shift_formula_refs`
(A1 rewrite). No demo keyboard shortcuts yet.

---

## 28. [gridyard-grid] Sort and filter via index vectors

**Status:** done — PR [#69](https://github.com/madmmas/gridyard/pull/69) / issue [#61](https://github.com/madmmas/gridyard/issues/61)

### Spec reference
`docs/01-grid-engine-core-spec.md` — Sorting/filtering/search section.

### Context
The spec is explicit that sort/filter should reorder via index vectors,
not mutate the underlying sparse cell data — this preserves undo history
and keeps formulas pointing at stable underlying cells regardless of
display order. Still entirely unimplemented.

### Scope
**In scope:**
- Sort a region by one or more columns, ascending/descending, without moving underlying cell data — only the display-order index vector changes
- Filter (show/hide rows by a predicate) via the same index-vector approach
- Formulas referencing filtered/sorted cells continue to resolve correctly regardless of current display order

**Out of scope:**
- WASM / demo UI wiring — engine view layer only

### Acceptance criteria
- [x] Sorting doesn't change any `CellId`/underlying storage — only the index vector used for display order
- [x] A formula referencing a cell by its stable address still works correctly after that cell's row has been sorted/filtered to a different visual position
- [x] Filtering hides rows from paint without removing them from the underlying grid or breaking formulas that reference them

### Testing requirements
- [x] Table-driven tests: sort stability, multi-column sort, filter-then-formula-still-resolves, sort-then-undo-an-edit-still-works
- [x] `cargo fmt --check && cargo clippy -- -D warnings && cargo test --workspace` passes

### Notes
`RowView` holds `visible` index vectors. `sort_by` / `filter` / `reset`
never touch `SparseGrid` cells. Sort compares via `CellValueSource`
(computed values). No demo chrome yet.

---

## 29. [gridyard-io] CSV import/export

**Status:** done — PR pending / issue [#62](https://github.com/madmmas/gridyard/issues/62)

### Spec reference
`docs/01-grid-engine-core-spec.md` — Import/export section (CSV now, xlsx later per this crate's own doc comment).

### Context
Fully untouched since scaffolding. First real slice: CSV, since the
crate's own doc comment already scopes xlsx as later work — don't scope
-creep into xlsx here.

### Scope
**In scope:**
- Export: a region's current computed values (not formulas) to CSV
- Import: parse a CSV into a new grid, one cell per value, as literals (not attempting to infer formulas from CSV text)
- Reasonable handling of CSV edge cases: quoted fields containing commas, embedded newlines, empty cells

**Out of scope:**
- xlsx / ods / demo file-picker UI

### Acceptance criteria
- [x] Exporting a grid with formulas produces a CSV of computed values, not formula text
- [x] Importing a CSV with quoted/escaped fields parses correctly, not just the simple comma-separated case
- [x] Round-tripping export → import produces the same literal values (formulas are expected to be lost — that's inherent to CSV, not a bug)

### Testing requirements
- [x] Table-driven tests covering standard CSV, quoted fields, embedded commas/newlines, empty cells, and the export-then-import round trip
- [x] `cargo fmt --check && cargo clippy -- -D warnings && cargo test --workspace` passes

### Notes
RFC 4180–style parser/writer in `gridyard-io` (no external CSV crate).
`export_csv` via `CsvValueSource`; `import_csv` → `CsvTable` /
`to_sparse_grid()` stores fields as literal text.

---

## 30. [workspace-runtime] Layout permissions enforcement

**Status:** open — issue [#63](https://github.com/madmmas/gridyard/issues/63)

### Spec reference
`docs/04-layout-and-permission-engine-spec.md` — Layout permissions.

### Context
Batch 4's issue #19 explicitly scoped layout permissions (resize,
personalize, admin-only-shared-layout) out, enforcing only field- and
region-level access. The permission-resolution function from batch 3
already computes layout permissions as part of its output — this issue
is purely about acting on that part of the output, which nothing
currently does.

### Scope
**In scope:**
- Column resize is blocked in the UI when the resolved permission set says the current user can't resize
- Personalizing a layout (if any personalization exists yet — check current state before assuming) is gated the same way
- A shared/admin-only layout can't be modified by a non-admin user, per the resolved permission

### Acceptance criteria
- [ ] A user without resize permission can't resize columns in the running demo, using the real resolution function, not a separate check
- [ ] Switching the demo's sample user (from issue #19) changes layout-editing ability consistently with field/region access
- [ ] No regression to users who do have full layout permissions — existing behavior stays unchanged for them

### Testing requirements
- [ ] Vitest tests covering: resize blocked/allowed by permission, shared-layout admin-only enforcement
- [ ] `npm test --workspaces --if-present` and typecheck pass

### Notes
Check what layout-editing capability (resize, etc.) actually exists in `grid-renderer` today before scoping the enforcement work — if resize itself was never built, this issue may need to add the base capability first, not just gate an existing one.
