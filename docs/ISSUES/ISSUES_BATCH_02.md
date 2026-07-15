# Second issue batch — from static render to a working interactive demo

**Batch status (2026-07-13):** all six batch issues (§7–§12) closed on
`main`. Type-to-edit UX (`#25`) was deferred polish and is now shipped
separately (see deferred section below).

| Batch § | GitHub | Title | PR |
|---------|--------|-------|----|
| 7 | [#17](https://github.com/madmmas/gridyard/issues/17) | Cell selection and keyboard navigation | [#23](https://github.com/madmmas/gridyard/pull/23) |
| 8 | [#18](https://github.com/madmmas/gridyard/issues/18) | Cell editing wired to gridyard-wasm | [#24](https://github.com/madmmas/gridyard/pull/24) |
| 9 | [#19](https://github.com/madmmas/gridyard/issues/19) | Undo/redo command stack | [#27](https://github.com/madmmas/gridyard/pull/27) |
| 10 | [#20](https://github.com/madmmas/gridyard/issues/20) | Workspace schema loader (main + bottom layout) | [#28](https://github.com/madmmas/gridyard/pull/28) |
| 11 | [#21](https://github.com/madmmas/gridyard/issues/21) | REST data-binding adapter | [#29](https://github.com/madmmas/gridyard/pull/29) |
| 12 | [#22](https://github.com/madmmas/gridyard/issues/22) | Wire web-demo end-to-end | [#30](https://github.com/madmmas/gridyard/pull/30) |

Batch 1 (PRs #9–#14) shipped the engine and a static renderer. This batch
closed the interactive loop: select → edit → undo, workspace schema + REST
binding against the mock server, and a real `web-demo` main region showing
`loans`. The bottom region (Aggregate / Notes) stays for the next batch —
cross-region formulas need one working, editable, data-bound region first.

---

## 7. [grid-renderer] Cell selection and keyboard navigation

**Status:** done — PR #23 / issue #17

### Spec reference
`docs/02-rendering-layer-spec.md` — interaction/selection.

### Context
`grid-renderer` currently only paints (`paintStaticGrid`,
`asGridDataSource`, `computeGridLayout` from issue #6) — there's no way to
select a cell or move around the grid yet. This is the first interaction
layer, before editing.

### Scope
**In scope:**
- Click a cell → it becomes the active selection, visually highlighted
- Arrow keys move the active selection by one cell; Enter/Tab move down/right
- Selection state exposed so a future formula bar can read "what's selected"

**Out of scope:**
- Range selection (shift-click, drag) — single-cell only for now
- Actual editing — next issue

### Acceptance criteria
- [x] Clicking any visible cell updates the active selection and repaints the highlight
- [x] Arrow/Enter/Tab move selection correctly, including at grid edges (no out-of-bounds)
- [x] Selection state is readable from outside the module (not just internal)

### Testing requirements
- [x] Vitest tests for selection-movement logic (pure functions, not DOM/canvas)
- [x] `npm test --workspaces --if-present` and `npm run typecheck --workspaces --if-present` pass

### Notes
None yet.

---

## 8. [grid-renderer] Cell editing wired to gridyard-wasm

**Status:** done — PR #24 / issue #18

### Spec reference
`docs/01-grid-engine-core-spec.md` (formula bar/editing), `docs/02-rendering-layer-spec.md`.

### Context
Builds directly on issue #7's selection. This is the first time the
renderer actually calls back into the `Grid` WASM surface (`set_cell`/
`get_cell` from issue #5) instead of only reading a static data source —
closing the loop from "click a cell" to "see it recalculate."

### Scope
**In scope:**
- A formula bar showing the active cell's raw input (literal or `=formula`)
- Typing + Enter commits the edit via `Grid.set_cell`, then repaints affected cells from `Grid.get_cell`
- Cells whose computed value is `Value::Error(...)` render visibly distinct (e.g. red text) per the `ErrorKind` already defined in `gridyard-core`

**Out of scope:**
- Undo/redo of edits — next issue
- Multi-cell paste/fill

### Acceptance criteria
- [x] Editing a cell and pressing Enter updates that cell and any dependent cells on screen, using real `Grid` calls, not mock data
- [x] An invalid formula shows an error cell instead of crashing the renderer
- [x] Escape cancels an in-progress edit without calling `set_cell`

### Testing requirements
- [x] Vitest tests for the edit-commit/cancel logic, mocking the `GridDataSource`/WASM boundary
- [x] `npm test --workspaces --if-present` and typecheck pass

### Notes
This is the first issue where the renderer becomes genuinely interactive — worth a bit more manual testing in the demo app (issue #12) than usual before calling it done.

Formula-bar-only editing (click the bar to type) is intentional for this
slice. Spreadsheet-like type-to-edit / in-cell caret polish is deferred —
see **Deferred** below and GitHub `#25`.

---

## 9. [gridyard-grid] Undo/redo command stack

**Status:** done — PR #27 / issue #19

### Spec reference
`docs/01-grid-engine-core-spec.md` — Selection/clipboard/undo section.

### Context
`gridyard-grid` has been a placeholder since the repo was scaffolded —
this is its first real implementation. Now that issue #8 produces actual
edit events, there's something concrete to make undoable.

### Scope
**In scope:**
- Command pattern: each cell edit becomes a command capturing old/new raw input
- `undo()`/`redo()` operate on a bounded history stack (pick and document a max depth, e.g. 100)
- Wired so `gridyard-wasm`'s `Grid` can expose `undo`/`redo` methods that replay through `set_cell`

**Out of scope:**
- Undo/redo for future range operations (fill, paste, sort) — just single-cell edits for now
- Cross-region undo (bottom region doesn't exist yet)

### Acceptance criteria
- [x] Undo reverts the most recent edit's raw input and recalculates dependents correctly
- [x] Redo re-applies an undone edit
- [x] A new edit after an undo clears the redo stack (standard undo-tree behavior, not branching)
- [x] History is bounded — doesn't grow unbounded over a long session

### Testing requirements
- [x] Table-driven tests: undo/redo chains, redo-cleared-by-new-edit, bounded history eviction
- [x] `cargo fmt --check && cargo clippy -- -D warnings && cargo test --workspace` passes

### Notes
None yet.

---

## 10. [workspace-runtime] Workspace schema loader (main + bottom layout)

**Status:** done — PR #28 / issue #20

### Spec reference
`docs/03-workspace-schema-spec.md`, `docs/04-layout-and-permission-engine-spec.md`.

### Context
`workspace-runtime` is still pure scaffolding (`export {}`). This is its
first real slice: parse a declarative JSON workspace definition into a
layout descriptor the renderer can consume — main + bottom regions, per
the current (two-region, tabbed-bottom) version of `docs/04`. No
permissions yet, no data binding yet — just the shape of the layout.

### Scope
**In scope:**
- A workspace definition schema (TypeScript types + a parser/validator) covering: region list (main, bottom), bottom's two tabs (Aggregate, Notes), field/column definitions (name, type, synced-from-main flag for bottom's Aggregate columns)
- Validation errors are specific and actionable (which field, what's wrong), not just "invalid schema"

**Out of scope:**
- Actually rendering the bottom region — that's the next batch, after this loader exists
- Permission levels (workspace/region/field/layout from `docs/04`) — later issue
- Data binding adapters — issue #11

### Acceptance criteria
- [x] A loan-review-shaped workspace definition (matching `docs/03`'s example and `apps/mock-server/db.json`'s `loans` fixture) parses into a typed layout descriptor
- [x] Malformed definitions (missing required field, unknown region name) fail validation with a specific error, not a generic throw
- [x] Bottom's Aggregate-tab-columns-synced-to-main constraint from `docs/04` is represented in the type, not just assumed

### Testing requirements
- [x] Vitest tests covering valid definitions, each documented invalid case, and the sync constraint
- [x] `npm test --workspaces --if-present` and typecheck pass

### Notes
None yet.

---

## 11. [workspace-runtime] REST data-binding adapter, wired to the mock server

**Status:** done — PR #29 / issue #21

### Spec reference
`docs/04-layout-and-permission-engine-spec.md` — Data binding engine.

### Context
`apps/mock-server` has served fixture data (`loans`, `employees`,
`invoices`) since the repo was scaffolded, but nothing in the JS/TS layer
has ever actually fetched from it. This issue is the first real adapter:
REST in, workspace-runtime's binding chain out.

### Scope
**In scope:**
- A REST adapter implementing the binding-path chain described in `docs/04` (data object → field → cell), fetching from `apps/mock-server`'s `/loans` endpoint
- Adapter interface is generic enough that a future GraphQL/DB adapter could implement the same shape (per `docs/04`'s "possible adapters" list) — don't hardcode REST assumptions into the interface itself

**Out of scope:**
- Write-back (editing a cell doesn't PATCH the mock server yet — read-only binding for now)
- Any adapter besides REST

### Acceptance criteria
- [x] Fetching the `loans` fixture through the adapter produces data shaped correctly for the layout descriptor from issue #10
- [x] A network/fetch failure surfaces as a typed error, not an unhandled rejection
- [x] Adapter interface has no REST-specific types leaking into its public shape

### Testing requirements
- [x] Vitest tests against a mocked fetch (don't require the real mock-server process running for unit tests)
- [x] `npm test --workspaces --if-present` and typecheck pass

### Notes
`docker-compose.yml` already runs the mock server on :4000 for local/manual testing of this end-to-end, separate from the unit tests above.

---

## 12. [apps/web-demo] Wire it all together into a real running demo

**Status:** done — PR #30 / issue #22

### Spec reference
All of the above, plus `docs/06-mvp-scope-and-roadmap.md`'s MVP user flow.

### Context
`apps/web-demo` has been an empty stub since scaffolding. This issue is
where everything shipped in issues #7–#11 (plus the existing engine from
batch 1) becomes an actual page you can open in a browser: the `loans`
fixture, loaded through the REST adapter, laid out via the workspace
schema, rendered by `grid-renderer`, selectable, editable, undoable.

### Scope
**In scope:**
- A real `dev`/`build` script (replacing the `exit 0` placeholders) that boots a page rendering the main region only, loaded from the mock server's `loans` fixture
- Click-to-select, edit-and-recalculate, and undo/redo all work end-to-end in the browser, not just in unit tests

**Out of scope:**
- The bottom region (next batch)
- Any styling polish beyond what's needed to confirm it works — this is a functional milestone, not a visual one

### Acceptance criteria
- [x] `npm run dev --workspace=web-demo` (or equivalent) serves a page showing the real `loans` data, not placeholder rows
- [x] Editing a cell with a formula referencing another cell recalculates visibly in the browser
- [x] Undo/redo work from the running page, not just in isolated tests

### Testing requirements
- [x] Whatever unit tests make sense for any new glue code in `web-demo` itself
- [x] `npm test --workspaces --if-present`, typecheck, and `npm run build --workspaces --if-present` all pass

### Notes
This is the milestone worth a manual click-through before closing — the
acceptance criteria above are explicitly about it working in a browser,
not just CI passing.

---

## Deferred (not in this batch)

Batch §7–§12 are done. This polish item stays open on purpose so the
interactive demo milestone did not wait on spreadsheet edit UX.

### [grid-renderer] Type-to-edit and formula-bar focus polish — `#25`

**Status:** done — this PR / issue [#25](https://github.com/madmmas/gridyard/issues/25)

**Shipped slice:** With a cell selected and the canvas focused, a printable
key type-over-replaces into the formula bar; `F2` and double-click open the
bar with the existing cell input and the caret at the end. Enter still
commits / Escape cancels via the existing formula-bar path. True in-cell
caret overlay on the canvas remains a later follow-up if needed.

**GitHub:** https://github.com/madmmas/gridyard/issues/25
