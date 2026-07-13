# First issue batch — foundational engine slices

Six issues, in build order. Each maps to one spec section and is scoped to
land as a single PR. Paste each block in as its own GitHub issue (title on
the first line), or create them with:

```
gh issue create --title "<title>" --body-file <(cat <<'EOF'
<body>
EOF
)
```

**Batch status (2026-07-13):** all six issues closed on `main`.

| # | Title | PR |
|---|-------|----|
| 1 | Cell and Value data model | [#9](https://github.com/madmmas/gridyard/pull/9) |
| 2 | Lexer and parser for arithmetic + cell refs | [#10](https://github.com/madmmas/gridyard/pull/10) |
| 3 | Function calls and the v0.1 function list | [#11](https://github.com/madmmas/gridyard/pull/11) |
| 4 | Dependency graph, dirty-marking, recalculation | [#12](https://github.com/madmmas/gridyard/pull/12) |
| 5 | Minimal WASM surface | [#13](https://github.com/madmmas/gridyard/pull/13) |
| 6 | Static single-region canvas renderer | [#14](https://github.com/madmmas/gridyard/pull/14) |

---

## 1. [gridyard-core] Cell and Value data model

**Status:** done — PR #9 / issue #1

### Spec reference
`docs/01-grid-engine-core-spec.md` — Data model section.

### Context
`CellId` packing (`cell_id`/`unpack_cell_id`) already exists with tests.
This issue is the next slice: the `Value` enum and `Cell` struct that sit on
top of it.

### Scope
**In scope:**
- `Value` enum: `Number(f64)`, `Text(String)`, `Bool(bool)`, `Empty`, `Error(ErrorKind)`
- `Cell` struct: raw input (formula or literal), computed `Value`, style id placeholder
- Sparse storage: `HashMap<CellId, Cell>` wrapper with get/set/remove

**Out of scope:**
- Formula parsing/evaluation (separate issue below)
- Styling beyond a placeholder `StyleId`

### Acceptance criteria
- [x] `Value` and `Cell` types defined in `gridyard-core`
- [x] Sparse grid wrapper exposes `get_cell`, `set_cell`, `remove_cell`
- [x] Empty cells are never stored (removing a cell that becomes empty frees the entry)

### Testing requirements
- [x] Unit tests colocated per `.cursor/rules/030-testing.mdc`, table-driven for `Value` equality/coercion cases
- [x] `cargo fmt --check && cargo clippy -- -D warnings && cargo test --workspace` passes

### Notes
Landed: `Value`, `ErrorKind`, `Cell`, `SparseGrid` in `gridyard-core`. Empty
cells are not stored. Coercion helpers (`coerce_number` / `coerce_bool` /
`coerce_text`) included for later formula eval.

---

## 2. [gridyard-formula] Lexer and parser for arithmetic + cell references

**Status:** done — PR #10 / issue #2

### Spec reference
`docs/01-grid-engine-core-spec.md` — Formula engine pipeline.

### Context
First slice of the formula engine: turn a formula string into an AST.
Evaluation is a separate issue so this one stays reviewable.

### Scope
**In scope:**
- Lexer: numbers, `+ - * /`, parentheses, cell references (`A1`, `B2`), ranges (`A1:A8`)
- Parser: precedence-correct arithmetic AST
- Clear, position-aware parse errors (not just "invalid formula")

**Out of scope:**
- Function calls (`SUM`, `IF`, etc.) — next issue
- Evaluation against actual cell data

### Acceptance criteria
- [x] `parse_formula(&str) -> Result<Ast, ParseError>` compiles and handles the operator set above
- [x] Precedence and parenthesization verified by tests (e.g. `1+2*3` vs `(1+2)*3`)
- [x] Range syntax (`A1:A8`) parses to a distinct AST node from a single ref

### Testing requirements
- [x] Table-driven tests covering valid formulas, precedence edge cases, and malformed input
- [x] `cargo fmt --check && cargo clippy -- -D warnings && cargo test --workspace` passes

### Notes
Landed: `parse_formula`, slotmap arena AST, A1 refs vs ranges, position-aware
errors. Function calls deferred to issue #3 (as planned).

---

## 3. [gridyard-formula] Function calls and the v0.1 function list

**Status:** done — PR #11 / issue #3

### Spec reference
`docs/01-grid-engine-core-spec.md` — v0.1 function list.

### Context
Builds directly on issue #2's AST to add function-call syntax and the
initial function set (SUM, AVERAGE, IF, and whatever else the spec's v0.1
list names).

### Scope
**In scope:**
- Parser support for `NAME(arg, arg, ...)` syntax, including range args
- Evaluator implementations for the v0.1 function list

**Out of scope:**
- Cross-region references (`main!A1`) — later issue, depends on `gridyard-grid`/`gridyard-graph` existing

### Acceptance criteria
- [x] Each v0.1 function evaluates correctly against literal inputs (no live grid needed yet)
- [x] Unknown function name produces a clear `Error(ErrorKind::Name)` value, not a panic
- [x] Wrong arg count/type produces the correct `ErrorKind` per spec

### Testing requirements
- [x] One table-driven test module per function
- [x] `cargo fmt --check && cargo clippy -- -D warnings && cargo test --workspace` passes

### Notes
Landed: `Expr::Call` / text / bool literals; v0.1 functions; `Value::Array`;
`evaluate` / sheet-aware evaluation helpers.

---

## 4. [gridyard-graph] Dependency graph, dirty-marking, recalculation

**Status:** done — PR #12 / issue #4

### Spec reference
`docs/01-grid-engine-core-spec.md` — Dependency graph and recalculation.

### Context
Connects formulas to actual recalculation order. This is the piece that
makes editing one cell correctly update everything downstream.

### Scope
**In scope:**
- Dependency graph keyed by `CellId`, built from parsed formula ASTs
- Dirty-marking on cell edit, propagated to dependents
- Topological recalculation order; cycle detection with a clear `Error(ErrorKind::Circular)`

**Out of scope:**
- Cross-region graphs (main vs. bottom's Aggregate tab keep separate graphs per `docs/04`) — wire that up when `gridyard-grid` regions exist

### Acceptance criteria
- [x] Editing a cell recalculates exactly its dependents, in correct topological order
- [x] A circular reference is detected and reported per-cell, without crashing or infinite-looping
- [x] Recalculation is incremental — unrelated cells are never touched

### Testing requirements
- [x] Tests covering: linear chains, diamond dependencies, circular references, disjoint graphs
- [x] `cargo fmt --check && cargo clippy -- -D warnings && cargo test --workspace` passes

### Notes
Landed: `DepGraph` + `SheetEngine` — dirty propagation, topo order, cycles →
`ErrorKind::Circular`.

---

## 5. [gridyard-wasm] Minimal WASM surface: create grid, set/get cell, evaluate

**Status:** done — PR #13 / issue #5

### Spec reference
`docs/01-grid-engine-core-spec.md` — Multi-threading/import-export section (WASM boundary); `docs/02-rendering-layer-spec.md` for the consumer side.

### Context
First time anything in the workspace crosses the WASM boundary. Keep the
API surface intentionally tiny so `grid-renderer` has something real to
render against.

### Scope
**In scope:**
- `wasm-bindgen` exports: `create_grid()`, `set_cell(row, col, input: &str)`, `get_cell(row, col) -> JsValue`
- Wires `gridyard-core` + `gridyard-formula` + `gridyard-graph` together behind this API

**Out of scope:**
- Undo/redo, clipboard, styling — later issues
- Binary serialization/import-export

### Acceptance criteria
- [x] A trivial JS/TS snippet can create a grid, set a formula cell, and read back the computed value
- [x] Setting a cell that others depend on updates their values on the next `get_cell` call

### Testing requirements
- [x] Rust-side unit tests for the wrapper functions (not just re-testing lower crates)
- [x] `cargo test --workspace` passes; a minimal `wasm-pack build` succeeds

### Notes
Landed: `create_grid` / `set_cell` / `get_cell` via `wasm-bindgen`. Only
`gridyard-wasm` depends on WASM; native `GridHandle` keeps unit tests
runnable without a browser.

---

## 6. [grid-renderer] Static single-region canvas renderer

**Status:** done — PR #14 / issue #6

### Spec reference
`docs/02-rendering-layer-spec.md` — Canvas-over-DOM rendering.

### Context
First real UI: render one grid region (main only, no bottom sync yet) from
the WASM API in issue #5, matching the spreadsheet-style headers described
in `docs/04-layout-and-permission-engine-spec.md` (ref row, name row,
row-number gutter).

### Scope
**In scope:**
- Canvas rendering of a fixed-size grid: ref row (A, B, C…), name row, row gutter, cell values
- Reads from the `gridyard-wasm` API; no editing yet (read-only render)

**Out of scope:**
- Virtual scrolling/windowing for large grids
- The bottom region, tabs, or any cross-region sync
- Editing, formula bar, selection

### Acceptance criteria
- [x] Renders a grid whose cell values come from actual `gridyard-wasm` calls, not mock data
- [x] Column letters and row numbers match standard A1-style addressing
- [x] Matches the visual structure in `docs/workspace-ui-mockup.html`'s main panel closely enough to be a faithful first pass

### Testing requirements
- [x] Vitest tests for the pure logic (address-to-letter conversion, layout math) — not pixel-diffing the canvas
- [x] `npm test --workspaces --if-present` passes

### Notes
Landed: `@gridyard/grid-renderer` (`paintStaticGrid`, A1 helpers, layout
math) + `apps/web-demo` Vite app seeding a loan-review sheet from real WASM.
Local demo: `make demo` (or `npm run dev --workspace=web-demo`). CI builds
without wasm-pack via stub + ambient `*gridyard_wasm.js` types.
