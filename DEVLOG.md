# Devlog

Running, dated log of real decisions, dead ends, and context that doesn't
belong in a spec file or a single PR description. Newest entry on top.

Format: `## YYYY-MM-DD` heading, then short bullets. Add an entry whenever a
PR resolves something the spec left ambiguous, or whenever a direction gets
tried and abandoned — that's the whole point of this file existing.

---

## 2026-07-14

- Batch 04 §23 (`@gridyard/grid-renderer`): `createPaintScheduler()` coalesces
  per-region paints onto the next animation frame so cascading dirties run one
  paint per region per frame (last paint fn wins). Stacked on §22 virtualization.

- Batch 04 §22 (`@gridyard/grid-renderer`): viewport row virtualization
  (`visibleRowRange` + `paintStaticGrid({ viewport })`). Horizontal
  virtualization skipped (few columns). Demo scroll-host wiring left as
  follow-up. Unit paint isolation checked against a **5 000-row** virtual
  viewport.
- Batch 04 §19 (`@gridyard/workspace-runtime` + `@gridyard/grid-renderer`):
  `projectColumnsForPermissions` / `authorizeFieldEdit` + column remapping and
  `commitEditWithAccess`. Sample Loan Review users in
  `loan-review-permissions`. Demo user-switcher glue remains on
  `backup/batch04-full-wip` until the dedicated web-demo follow-up lands.

- Third issue batch (`docs/ISSUES/ISSUES_BATCH_03.md` §13–§18) landed on
  `main`:
  - **#32 / PR #39 — `gridyard-graph` + formula:** independent main/bottom
    engines; `main!A1` / range cross-region reads; no bottom→main deps.
  - **#33 / PR #40 — `gridyard-wasm`:** `create_workspace()` with
    region-addressed `set_cell` / `get_cell` / `get_input`.
  - **#34 / PR #41 — `@gridyard/grid-renderer` + demo:** bottom Aggregate
    paint, column sync from main, `SUM`/`AVERAGE(main!…)` seeded totals.
  - **#35 / PR #42 — demo Notes + tabs:** Aggregate/Notes switch without
    resizing bottom; Notes is in-memory (no WASM); Aggregate draft preserved.
  - **#36 / PR #43 — `@gridyard/workspace-runtime`:** permission resolution
    (workspace / region / field / layout) with core→company→department→user
    overlays; no auth, no UI enforcement, no mock-server permission JSON.
  - **#37 / PR #44 — `web-demo` close-out:** restore Workspace undo/redo (shared
    stack across main+bottom); ⌘/Ctrl+Z / Shift+Z / Ctrl+Y; clear history
    after seed so fixture load isn't undoable.
- Undo decision: one shared history for the whole `Workspace`, not
  per-region stacks — editing main then bottom undoes bottom first. Matches
  how users expect a single document, and Aggregate formulas that follow
  main edits stay consistent when undoing.
- Permission JSON on the mock server deferred until something loads overlays
  over REST; unit tests build layers in memory.

## 2026-07-13

- Second issue batch (`docs/ISSUES/ISSUES_BATCH_02.md` §7–§12) landed on
  `main`:
  - **#17 / PR #23 — `@gridyard/grid-renderer`:** single-cell selection +
    keyboard nav (`moveSelection`, hit-test, paint highlight).
  - **#18 / PR #24 — editing:** formula bar ↔ WASM `set_cell` / `get_input`;
    soft-fail bad formulas → `#VALUE!`; error cells painted red.
  - **#19 / PR #27 — `gridyard-grid` + WASM:** bounded undo/redo stack
    (depth 100); demo ⌘/Ctrl+Z / Shift+Z / Ctrl+Y.
  - **#20 / PR #28 — `@gridyard/workspace-runtime`:** parse/validate
    workspace JSON → layout; Aggregate `syncedFromMain` + `fieldId`;
    `LOAN_REVIEW_WORKSPACE` fixture.
  - **#21 / PR #29 — REST adapter:** transport-agnostic `DataAdapter` +
    binding path → cells; `createRestDataAdapter` for mock `/loans`;
    typed fetch errors (no unhandled rejections); read-only (no write-back).
  - **#22 / PR #30 — `web-demo`:** schema + REST + renderer + edit + undo
    e2e on real loans; Vite proxies `/loans` → `:4000`. Run `make up` +
    `make demo`.
- Edit UX decision: formula-bar-only typing is enough for this milestone.
  Spreadsheet-like type-to-edit / `F2` / double-click / in-cell caret is
  tracked as deferred [#25](https://github.com/madmmas/gridyard/issues/25) —
  leave it until demo edit friction bites; prefer bottom-region next batch
  otherwise.
- Issue batches live under `docs/ISSUES/` (paths moved from
  `docs/ISSUES_BATCH_*.md`).
- First issue batch (`docs/ISSUES/ISSUES_BATCH_01.md` #1–#6) landed on `main`:
  - **#1 / PR #9 — `gridyard-core`:** `Value`, `ErrorKind`, `Cell`,
    `SparseGrid`; empty cells never stored; coercion helpers for formula
    eval.
  - **#2 / PR #10 — `gridyard-formula`:** lexer + recursive-descent parser;
    slotmap AST; A1 refs vs ranges; position-aware parse errors.
  - **#3 / PR #11 — `gridyard-formula`:** call / text / bool syntax; v0.1
    function set; `Value::Array`; evaluate helpers (incl. sheet-backed).
  - **#4 / PR #12 — `gridyard-graph`:** `DepGraph` + `SheetEngine`; dirty
    marking, topo recalc, cycles → `ErrorKind::Circular`.
  - **#5 / PR #13 — `gridyard-wasm`:** minimal `create_grid` / `set_cell` /
    `get_cell` WASM surface; native handle for unit tests.
  - **#6 / PR #14 — `@gridyard/grid-renderer` + `web-demo`:** static canvas
    main-region paint from live WASM; A1 letters, layout math, Vitest for
    pure logic. Demo: `make demo`.
- Web-demo CI lessons: keep `vite build` free of wasm-pack; load WASM from
  `src/wasm-pkg` (Vite forbids importing from `public/`); ambient
  `declare module "*gridyard_wasm.js"` so typecheck works when the
  gitignored pkg is absent.
- Tooling aligned with CI (PR #15): pre-commit + `make check` now include
  typecheck, build, `cargo deny`, and `npm audit`; added `make wasm` /
  `make demo`; `make clean` clears wasm-pack output.

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
