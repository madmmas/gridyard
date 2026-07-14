# Third issue batch — the bottom region and cross-region formulas

**Batch status (2026-07-14):** all six batch issues (§13–§18) closed on
`main` (see PR column). Permission UI enforcement and type-to-edit (#25)
remain deferred.

| Batch § | GitHub | Title | PR |
|---------|--------|-------|----|
| 13 | [#32](https://github.com/madmmas/gridyard/issues/32) | Independent per-region dependency graph and cross-region reads | [#39](https://github.com/madmmas/gridyard/pull/39) |
| 14 | [#33](https://github.com/madmmas/gridyard/issues/33) | Multi-region WASM surface | [#40](https://github.com/madmmas/gridyard/pull/40) |
| 15 | [#34](https://github.com/madmmas/gridyard/issues/34) | Render the bottom region's Aggregate tab | [#41](https://github.com/madmmas/gridyard/pull/41) |
| 16 | [#35](https://github.com/madmmas/gridyard/issues/35) | Bottom region's Notes tab and tab switching | [#42](https://github.com/madmmas/gridyard/pull/42) |
| 17 | [#36](https://github.com/madmmas/gridyard/issues/36) | Permission engine (four levels, with inheritance) | [#43](https://github.com/madmmas/gridyard/pull/43) |
| 18 | [#37](https://github.com/madmmas/gridyard/issues/37) | Wire the bottom region into the running demo | [#44](https://github.com/madmmas/gridyard/pull/44) |

Checked the live repo before writing these: all of batch 2 is merged
(PRs #23–#31) — selection, keyboard nav, formula-bar editing wired to
real `Grid.set_cell`/`get_cell` calls, a bounded undo/redo command stack,
a workspace schema loader that already models both main and bottom
regions structurally, a REST adapter reading the mock server's `loans`
fixture, and a working `web-demo` page with all of it wired together end
to end. One issue is open and untouched by design: **#25**, "Type-to-edit
and formula-bar focus polish" — explicitly deferred scope (type-over/F2
to start an edit without clicking the formula bar first), not a blocker
for anything below. Pick it up whenever the demo's edit UX starts to
feel like friction; it doesn't need to happen before this batch.

The schema loader from batch 2 (#20) already has *types* for the bottom
region and its two tabs, but nothing renders it, nothing computes it, and
nothing lets a formula in one region read from the other yet. This batch
closes that: a second, column-synced grid region with its own two tabs
(Aggregate, Notes), cross-region formula reads, and — since
`workspace-runtime`'s docstring names four engines and only two
(layout/schema, data binding) are done — the permission engine that's
been untouched since scaffolding.

---

## 13. [gridyard-graph] Independent per-region dependency graph and cross-region reads

### Spec reference
`docs/04-layout-and-permission-engine-spec.md` — Cross-region formula references.

### Context
`DepGraph`/`SheetEngine` (from batch 1, issue #4) currently model exactly
one sheet. Per `docs/04`, main and bottom's Aggregate tab each keep their
own dependency graph — no single merged graph — with cross-region
references resolving as reads into the other region's current values.
This issue is the engine-level foundation the rest of the batch builds on.

### Scope
**In scope:**
- A way to run two independent `SheetEngine`/`DepGraph` instances side by side (one per region) without them sharing dirty-marking or recalculation order
- A cross-region reference type (e.g. `main!A1`, `main!B2:B8`) that resolves by reading the other region's current computed value — a read-only dependency edge into a graph this engine doesn't own
- Editing a cell in main correctly triggers recalculation of any bottom-Aggregate formulas that reference it, without touching main's own recalculation order

**Out of scope:**
- Writing from bottom back into main (not part of the spec — bottom only reads from main)
- More than two regions — this is main + bottom only, per the current `docs/04`

### Acceptance criteria
- [ ] Two independently-recalculating engines can coexist, each with correct dirty-marking within itself
- [ ] A bottom-region formula referencing `main!A1` recalculates when `main`'s `A1` changes, without main's own graph needing to know bottom exists
- [ ] A cross-region reference to a region/cell that doesn't exist yet resolves to a clear error value, not a panic

### Testing requirements
- [ ] Table-driven tests: same-region recalculation (regression against #4's existing cases), cross-region propagation, missing-reference error case
- [ ] `cargo fmt --check && cargo clippy -- -D warnings && cargo test --workspace` passes

### Notes
None yet.

---

## 14. [gridyard-wasm] Multi-region WASM surface

### Spec reference
`docs/01-grid-engine-core-spec.md` (WASM boundary), `docs/04` (regions).

### Context
The `Grid` WASM wrapper (batch 1, issue #5) exposes exactly one sheet.
This issue extends the WASM surface so JS can create and address a second,
named region (bottom) alongside main, using issue #13's cross-region
engine underneath.

### Scope
**In scope:**
- A JS-facing way to create a workspace with two named regions (`main`, `bottom`) instead of one anonymous `Grid`
- `set_cell`/`get_cell` addressed by region name, e.g. `workspace.set_cell("bottom", 0, 1, "=main!B2:B8")`
- Region creation doesn't require the caller to know about `gridyard-graph`'s internals — this stays a thin JS-facing wrapper, same spirit as the existing `Grid`

**Out of scope:**
- More than two regions
- Tabs (Aggregate vs. Notes) — that's a `grid-renderer`/UI-level concept per `docs/04`, not something the WASM layer needs to know about; Notes is unsynced/no-formula, so it doesn't need this engine at all (see issue #16)

### Acceptance criteria
- [ ] A trivial JS snippet can create a two-region workspace, set a bottom-region cell referencing main, and read back the correct computed value
- [ ] Editing main and re-reading the bottom cell reflects the update
- [ ] Existing single-region `Grid` usage (from issue #5 onward) keeps working — don't break `web-demo`'s current main-only wiring while this lands

### Testing requirements
- [ ] Rust-side tests for the new wrapper surface, mirroring issue #5's test style
- [ ] `cargo test --workspace` passes; `wasm-pack build` still succeeds

### Notes
None yet.

---

## 15. [grid-renderer] Render the bottom region's Aggregate tab

### Spec reference
`docs/04-layout-and-permission-engine-spec.md` — Dimension-synced grid regions, Spreadsheet-style headers.

### Context
First time anything renders a second region. Per `docs/04`, bottom's
Aggregate tab reuses main's exact column letters and widths (columns are
synced), but has its own independent row numbers, own header, own
scrolling, and a real visual gap from main — never a merged frozen-pane
look.

### Scope
**In scope:**
- A second `paintStaticGrid`-style region, positioned below main, whose column widths are locked to main's current widths
- Its own row-number gutter (independent of main's), its own formula bar
- Reuses selection/editing/undo from issues #7–#9 within the Aggregate tab, addressed to the `"bottom"` region from issue #14

**Out of scope:**
- The Notes tab — issue #16
- Column-width *editing* propagating live from main to bottom if main's columns are resized after initial layout — reuse whatever main's current widths are at render time; live-resize sync can be a follow-up if column resizing doesn't exist yet at all (check before scoping further)

### Acceptance criteria
- [ ] Bottom's Aggregate tab renders with column widths visually matching main's, column-for-column
- [ ] Editing a bottom-Aggregate cell with a `main!...` reference computes and displays correctly, using issue #14's WASM surface
- [ ] Bottom and main are visually distinct regions (own border/background/header), never rendered as a single merged grid

### Testing requirements
- [ ] Vitest tests for the column-width-sync logic specifically (pure function: given main's layout, compute bottom's column positions)
- [ ] `npm test --workspaces --if-present` and typecheck pass

### Notes
None yet.

---

## 16. [grid-renderer] Bottom region's Notes tab and tab switching

### Spec reference
`docs/04-layout-and-permission-engine-spec.md` — Tabs within a region, spreadsheet-style headers (Notes as the exception).

### Context
Bottom has two tabs; issue #15 covers Aggregate. This issue covers Notes
— a plain, unsynced label-value list with no formulas, no column
letters, no row gutter — plus the tab-switching control itself. Matches
`docs/workspace-ui-mockup.html`'s existing Notes panel, which was built
by hand as a static reference before any of this engine work existed.

### Scope
**In scope:**
- Tab buttons (Aggregate / Notes) that toggle which tab's content is shown, without changing bottom's outer width or position
- A plain label-value table for Notes — no engine/WASM involvement at all, since Notes has no formulas (per `docs/04`, this is the deliberate no-formula exception)
- Switching tabs preserves each tab's own state (e.g. switching away from Aggregate mid-edit shouldn't lose that edit)

**Out of scope:**
- Persisting Notes content anywhere beyond in-memory for now (no backend write-back yet — matches main/Aggregate's current read-mostly state from batch 2)

### Acceptance criteria
- [ ] Clicking a tab switches visible content without resizing or repositioning the bottom region
- [ ] Notes content has no formula bar, no column letters, no row gutter — visually distinct from Aggregate, per spec
- [ ] Add-row/add-column controls (if implemented elsewhere by this point) apply to whichever tab is currently active, not globally

### Testing requirements
- [ ] Vitest tests for tab-switching state logic
- [ ] `npm test --workspaces --if-present` and typecheck pass

### Notes
None yet.

---

## 17. [workspace-runtime] Permission engine (four levels, with inheritance)

### Spec reference
`docs/04-layout-and-permission-engine-spec.md` — Permission engine, Permission inheritance.

### Context
`workspace-runtime`'s docstring names four engines: layout, permission,
schema parser, data binding. Schema parsing and data binding landed in
batch 2; layout is effectively covered by the schema loader's region
model. Permissions are the one piece never started. This is independent
of the rendering work above (issues #13–16) and could land in parallel.

### Scope
**In scope:**
- The four permission levels from `docs/04`: workspace access, region access, field-level (view/edit/hidden), layout (resize/personalize/admin-only-shared-layout)
- Layered inheritance: core → company → department → user, each level able to override the one above without forking the underlying workspace definition
- A resolution function: given a user's position in that hierarchy plus the layered overrides, produce the effective permission set for a given field/region/layout action

**Out of scope:**
- Any actual auth/identity system — this takes a user's hierarchy position as an input, it doesn't determine it
- UI enforcement (disabling buttons, hiding fields in `grid-renderer`) — that's a follow-up once this resolution logic exists and something calls it

### Acceptance criteria
- [ ] A department-level override correctly overrides a company-level default without needing a forked workspace definition
- [ ] Resolution order is deterministic and tested: core, then company, then department, then user, each layer only overriding what it explicitly sets
- [ ] Field-level `hidden` and region-level access are represented distinctly (hidden fields vs. inaccessible regions aren't the same thing)

### Testing requirements
- [ ] Vitest tests covering each inheritance layer overriding correctly, and a case with no overrides at any layer (falls through to core)
- [ ] `npm test --workspaces --if-present` and typecheck pass

### Notes
None yet.

---

## 18. [apps/web-demo] Wire the bottom region into the running demo

**Status:** done — PR #44 / issue #37 (demo already had main+bottom+tabs from
#34/#35; this restores Workspace undo/redo and batch close-out docs).

### Spec reference
All of the above.

### Context
Closes out this batch the same way issue #12 closed batch 2 — everything
above becomes visible and clickable in the actual running page, not just
covered by unit tests.

### Scope
**In scope:**
- The demo page now shows main (from batch 2) plus bottom below it, columns synced, with working Aggregate (Total/Average, referencing main's loan amounts — matching the numbers already mocked up by hand in `docs/workspace-ui-mockup.html`) and Notes tabs
- Tab switching, cross-region formula display, and undo/redo all demonstrably work from the browser

**Out of scope:**
- Permission enforcement in the UI — issue #17 delivers the resolution logic, but wiring it into what the demo actually shows/hides can be its own follow-up once this batch proves the rendering path works unrestricted

### Acceptance criteria
- [ ] The running demo visually matches the two-region structure in `docs/workspace-ui-mockup.html` (main + bottom with tabs), now backed by real computed values instead of hand-typed mock numbers
- [ ] Editing a loan amount in main updates bottom's Aggregate totals live
- [ ] Switching to Notes and back preserves Aggregate's state

### Testing requirements
- [ ] Whatever unit tests make sense for new `web-demo` glue code
- [ ] `npm test --workspaces --if-present`, typecheck, and `npm run build --workspaces --if-present` all pass

### Notes
Same as batch 2's closing issue: worth a manual click-through in an actual browser before calling this done, not just a green CI run.
