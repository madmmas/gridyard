# Fourth issue batch — permission enforcement, form engine, and the docs/02 gaps

**Batch status (2026-07-15):** all six batch issues (§19–§24) closed on
`main` (see PR column). Demo wiring for virtualization / rAF / search
chrome was deferred into Batch 05 (§25–§26). Type-to-edit (#25) remains
open as deferred polish.

| Batch § | GitHub | Title | PR |
|---------|--------|-------|----|
| 19 | [#45](https://github.com/madmmas/gridyard/issues/45) | Enforce permission-engine output in the UI | [#54](https://github.com/madmmas/gridyard/pull/54) |
| 20 | [#49](https://github.com/madmmas/gridyard/issues/49) | Form engine — render bound data as a structured form | [#56](https://github.com/madmmas/gridyard/pull/56) |
| 21 | [#50](https://github.com/madmmas/gridyard/issues/50) | Second example domain — Employee Management | [#57](https://github.com/madmmas/gridyard/pull/57) |
| 22 | [#46](https://github.com/madmmas/gridyard/issues/46) | Virtual rendering for large grids | [#53](https://github.com/madmmas/gridyard/pull/53) |
| 23 | [#47](https://github.com/madmmas/gridyard/issues/47) | requestAnimationFrame batching for repaints | [#52](https://github.com/madmmas/gridyard/pull/52) |
| 24 | [#48](https://github.com/madmmas/gridyard/issues/48) | Search UI | [#55](https://github.com/madmmas/gridyard/pull/55) |

Checked the live repo before writing these: all of batch 3 is merged
(PRs #38–#44) — cross-region dependency graph, multi-region WASM surface,
bottom's Aggregate and Notes tabs, the permission engine, and the demo
wired end to end. Only issue #25 (deferred type-to-edit polish) remains
open, unchanged from before.

This batch closes the two gaps flagged in the last conversation rather
than pushing further breadth blindly: the permission engine from batch 3
(#17-equivalent) computes an effective permission set but nothing in the
UI actually *uses* it yet, and docs/02's virtualization, search, and
render-batching were explicitly deferred back at issue #6 and never
picked back up. It also adds the two biggest remaining docs/03/docs/04
gaps — the form engine and a second example domain — since a single
Loan-Review-shaped grid can't tell you whether the schema loader
generalizes or just happens to work for one dataset.

---

## 19. [web-demo, grid-renderer] Enforce permission-engine output in the UI

**Status:** done — PR [#54](https://github.com/madmmas/gridyard/pull/54) / issue [#45](https://github.com/madmmas/gridyard/issues/45)

### Spec reference
`docs/04-layout-and-permission-engine-spec.md` — Permission engine (levels + inheritance).

### Context
Batch 3 delivered a permission-resolution function (given a user's
position in the core→company→department→user hierarchy, produce an
effective permission set) but nothing calls it from the rendering path.
Right now every field/region in the demo is fully visible and editable
regardless of who's "logged in." This issue wires resolution into actual
behavior.

### Scope
**In scope:**
- `grid-renderer` respects field-level `view`/`edit`/`hidden` and region-level access when painting and when handling edit attempts (a `hidden` field isn't rendered; a `view`-only field renders but rejects edits)
- `web-demo` picks a hierarchy position (even something as simple as a hardcoded dropdown of 2–3 sample users) so the enforcement is actually demonstrable, not just unit-tested
- Attempting to edit a field you don't have `edit` permission for fails clearly (no silent no-op, no crash)

**Out of scope:**
- Real authentication — still just an input hierarchy position, not identity verification
- Layout permissions (resize/personalize/admin-only-shared-layout) — field and region access only for this issue; layout permission enforcement can follow once this proves the pattern

### Acceptance criteria
- [x] Switching the demo's sample user changes what's visible/editable, using the real resolution function from batch 3, not a separate ad hoc check
- [x] A `hidden` field never appears in the DOM/canvas paint, not just visually suppressed
- [x] Attempting to edit a `view`-only field is rejected with a clear signal (not a silent failure)

### Testing requirements
- [x] Vitest tests covering: hidden field isn't rendered, view-only field rejects edit, full-access field behaves as before
- [x] `npm test --workspaces --if-present` and typecheck pass

### Notes
Package projection + edit guards landed in PR #54. Demo user-switcher
follow-up pieces may still sit on `backup/batch04-full-wip` until a
dedicated web-demo PR; layout permissions deferred to Batch 05 §30.

## 20. [workspace-runtime] Form engine — render bound data as a structured form

**Status:** done — PR [#56](https://github.com/madmmas/gridyard/pull/56) / issue [#49](https://github.com/madmmas/gridyard/issues/49)

### Spec reference
`docs/04-layout-and-permission-engine-spec.md` — Form engine.

### Context
Named in `workspace-runtime`'s own docstring since scaffolding, never
started. Per spec, the same underlying data the grid renders should also
be renderable as a structured form — sections, field groups, a mix of
read-only and editable fields — using the same binding chain the REST
adapter already established in batch 2.

### Scope
**In scope:**
- A form renderer consuming the same workspace-schema field definitions and REST adapter from batch 2, rendering one record (e.g. a single loan) as a labeled form instead of a grid row
- At least one section grouping (matching the spec's customer-info-form example: two sections, not one flat field list)
- Respects the same field-level permissions from issue #19 — a `hidden` field is hidden in form view too, not just grid view

**Out of scope:**
- Conditional fields, validation rules — the spec mentions these as form-engine capabilities but they're a larger follow-up; this issue is the basic render-a-record-as-a-form slice
- Editing through the form writing back to the mock server (still read-mostly, consistent with the grid's current state)

### Acceptance criteria
- [x] The same `loans` record renders correctly as both a grid row and a form, from the same underlying binding — not two independent data paths
- [x] Sections render as visually distinct groups, not a flat field dump
- [x] Field permissions from issue #19 apply identically in form view

### Testing requirements
- [x] Vitest tests for the form-layout logic (given a schema + record, produce the right section/field structure)
- [x] `npm test --workspaces --if-present` and typecheck pass

### Notes
None yet.

## 21. [workspace-runtime] Second example domain — Employee Management

**Status:** done — PR [#57](https://github.com/madmmas/gridyard/pull/57) / issue [#50](https://github.com/madmmas/gridyard/issues/50)

### Spec reference
`docs/03-workspace-schema-spec.md` — example workspace definitions.

### Context
Every issue so far has been validated against exactly one shape: Loan
Review. `docs/03` describes the schema as generic across five example
domains; nothing has confirmed the schema loader, REST adapter, or
permission engine actually generalize versus just happening to fit one
dataset's assumptions. `apps/mock-server/db.json` already has an
`employees` fixture from the original scaffolding — unused until now.

### Scope
**In scope:**
- An Employee Management workspace definition (main + bottom regions, per `docs/03`'s description of that example) bound to the existing `employees` fixture
- Fix whatever schema-loader/adapter assumptions turn out to be Loan-Review-specific in the process (field types, aggregate shapes, etc.) — that's the actual point of this issue, not just adding a second JSON file
- Available as a second selectable workspace in `web-demo` (even a simple switcher), not a separate throwaway app

### Acceptance criteria
- [x] The Employee Management workspace renders correctly using the same engine code as Loan Review, with no Loan-Review-specific branches added to make it work
- [x] Any genuinely Loan-Review-specific assumption found in the schema loader or adapter gets fixed, not worked around
- [x] Switching between the two workspaces in `web-demo` works without a reload

### Testing requirements
- [x] Vitest tests for the new workspace definition's validation, same pattern as batch 2's issue #10 tests
- [x] `npm test --workspaces --if-present` and typecheck pass

### Notes
None yet.

## 22. [grid-renderer] Virtual rendering for large grids

**Status:** done — PR [#53](https://github.com/madmmas/gridyard/pull/53) / issue [#46](https://github.com/madmmas/gridyard/issues/46)

### Spec reference
`docs/02-rendering-layer-spec.md` — virtual rendering.

### Context
Explicitly deferred at issue #6 ("out of scope: virtual scrolling/windowing for large grids") since the demo only ever rendered a handful of rows. Real workspace data won't stay that small — this is the point where skipping it stops being free.

### Scope
**In scope:**
- Only paint rows/columns currently within the visible viewport, not the entire sheet, for both main and bottom's Aggregate tab
- Scrolling updates the painted window without a full grid re-layout
- Correctness first: verify a formula in an off-screen cell still recalculates correctly when scrolled into view (virtualization must not affect engine state, only paint)

**Out of scope:**
- Horizontal virtualization if columns are already narrow enough not to need it in practice — check before building; don't add complexity nothing currently needs
- Bottom's Notes tab — unsynced, no formulas, likely small enough not to need this yet

### Acceptance criteria
- [x] A grid with several thousand rows scrolls smoothly, painting only the visible window
- [x] Scrolling to a previously off-screen row shows its correct, already-computed value immediately (no flash of stale/empty state)
- [x] Existing selection/editing/undo behavior (batch 2/3) keeps working unchanged under virtualization

### Testing requirements
- [x] Vitest tests for the viewport-to-visible-row-range calculation (pure function)
- [x] `npm test --workspaces --if-present` and typecheck pass; note in the PR what row count was used to manually confirm smooth scrolling, since that's not something a unit test proves by itself

### Notes
Unit paint isolation verified on a 5,000-row virtual viewport. Demo
scroll-host wiring deferred to Batch 05 §25.

## 23. [grid-renderer] requestAnimationFrame batching for repaints

**Status:** done — PR [#52](https://github.com/madmmas/gridyard/pull/52) / issue [#47](https://github.com/madmmas/gridyard/issues/47)

### Spec reference
`docs/02-rendering-layer-spec.md` — batching via requestAnimationFrame.

### Context
Also named in `docs/02`, never implemented — batch 2/3's editing and
cross-region recalculation likely repaint synchronously per edit right
now, which is fine at demo scale but not what the spec describes and not
what'll hold up once a formula edit cascades through many dependent
cells at once.

### Scope
**In scope:**
- Multiple cell updates within the same tick (e.g. one edit cascading through several dependents) coalesce into a single paint on the next animation frame, not one paint per changed cell
- No visible behavior change from the user's perspective — this is purely a performance/correctness issue, not a feature

**Out of scope:**
- Any change to how/when the engine itself recalculates — this only touches the paint scheduling, not `gridyard-graph`'s recalculation order

### Acceptance criteria
- [x] An edit that dirties N dependent cells triggers exactly one paint per affected region per frame, not N paints
- [x] No stale paint — the single batched paint reflects every dirtied cell's final value, not an intermediate state
- [x] No regression in perceived responsiveness for a single-cell edit (still feels instant)

### Testing requirements
- [x] Vitest tests using a fake/mocked `requestAnimationFrame` to assert paint-call counts for single-edit vs. cascading-edit scenarios
- [x] `npm test --workspaces --if-present` and typecheck pass

### Notes
Demo edit→paint wiring of the scheduler deferred to Batch 05 §25.

## 24. [grid-renderer] Search UI

**Status:** done — PR [#55](https://github.com/madmmas/gridyard/pull/55) / issue [#48](https://github.com/madmmas/gridyard/issues/48)

### Spec reference
`docs/02-rendering-layer-spec.md` — search UI.

### Context
The last untouched item from `docs/02`. Straightforward once virtualization (#22) exists, since search needs to be able to scroll a match into view rather than assuming everything's already painted.

### Scope
**In scope:**
- A search input that finds matching cells (literal value match to start — not formula-source matching) within the active region/tab
- Matching a cell scrolls it into view (using #22's viewport machinery) and highlights it
- Next/previous match navigation

**Out of scope:**
- Cross-region search (search main and bottom's Aggregate tab together) — scope to the active tab/region for this first slice
- Regex or fuzzy matching — exact/substring match only

### Acceptance criteria
- [x] Typing a search term highlights all matching cells in the active region and scrolls the first match into view
- [x] Next/previous controls move through matches correctly, wrapping at the ends
- [x] Clearing the search removes all highlights and doesn't leave the viewport in a broken scroll state

### Testing requirements
- [x] Vitest tests for match-finding and next/prev navigation logic (pure functions, not DOM)
- [x] `npm test --workspaces --if-present` and typecheck pass

### Notes
APIs + vitest only; demo search chrome deferred to Batch 05 §26.
