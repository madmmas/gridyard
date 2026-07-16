# Manual testing guide

Checklist for verifying shipped Gridyard behavior in the running demo and
(where not yet wired into the UI) via automated crate/package tests.

**Last updated:** 2026-07-15 (Batch 06 — form engine removed).

## Setup

```bash
# Terminal 1 — mock REST fixtures
make mock-server

# Terminal 2 — Vite + WASM demo
make demo
# or: npm run dev -w web-demo
```

Open the URL Vite prints (usually `http://localhost:5173`). Confirm the
status line loads loan rows from the mock server (not a fetch error).

---

## A. Demo layout (main + bottom only)

| # | Steps | Expected |
|---|--------|----------|
| A1 | Load the demo | Toolbar + **main** panel + **bottom** panel only. No form / record panel between them. |
| A2 | Inspect the page DOM / layout | No `#form-panel`, `#form-body`, or “form · selected row” chrome. |
| A3 | Read the hint under the grids | Mentions mock server, 5k rows, Find, permissions, Notes — **not** “form mirrors selected row”. |

---

## B. Workspace switcher

| # | Steps | Expected |
|---|--------|----------|
| B1 | Select **Loan Review** | Main header shows `main · loans`; sample loan borrowers appear. |
| B2 | Select **Employee Management** | Main header shows `main · employees`; employee rows load without a full page reload. |
| B3 | Switch back to Loan Review | Loans data returns; bottom Aggregate still tracks main columns. |

---

## C. Main grid — selection, formula bar, editing

| # | Steps | Expected |
|---|--------|----------|
| C1 | Click a main cell | Selection highlight moves; formula-bar address matches (e.g. `B2`); bar shows the cell’s input/value. |
| C2 | Arrow keys with canvas focused | Selection moves within bounds; status line updates. |
| C3 | Edit via formula bar: change a literal, press Enter | Value commits; dependents recalculate if formulas reference it. |
| C4 | Enter a bad formula (e.g. `=1/`) | Soft-fail: cell shows an error value (e.g. `#VALUE!`); paint uses error styling. |
| C5 | Escape while editing | Cancels draft; original value restored. |
| C6 | Double-click a cell | Formula bar focuses with existing input; caret at end. |
| C7 | With canvas focused, type a printable character | Type-over replaces into the formula bar (issue #25). |
| C8 | Press `F2` on a selected cell | Opens formula bar with existing input. |
| C9 | Tab / Enter after a commit | Selection advances per nav key. |

---

## D. Undo / redo

| # | Steps | Expected |
|---|--------|----------|
| D1 | Edit a cell, then Cmd/Ctrl+Z | Previous value restored. |
| D2 | Cmd/Ctrl+Shift+Z (or redo shortcut) | Edit reapplied. |
| D3 | Undo with nothing left | No crash; grid unchanged. |

---

## E. Bottom region — Aggregate

| # | Steps | Expected |
|---|--------|----------|
| E1 | Aggregate tab active on load | Bottom canvas visible; column headers match main field names/order. |
| E2 | Select a bottom cell; edit via its formula bar | Commits into the bottom engine (independent of main storage). |
| E3 | Enter a cross-region formula in bottom, e.g. `=main!A1` (or range) | Reads from main; updates when main source changes (after recalculation). |
| E4 | Click **+** on Aggregate | Adds a bottom Aggregate row. |

---

## F. Bottom region — Notes

| # | Steps | Expected |
|---|--------|----------|
| F1 | Click **Notes** tab | Aggregate canvas hidden; Notes table shown (label/value columns). |
| F2 | Edit a Notes value | Updates that row; no formula evaluation in Notes. |
| F3 | Click **+** on Notes | Adds a Notes row. |
| F4 | Switch back to Aggregate | Aggregate canvas returns; prior Aggregate selection/values intact. |

---

## G. Permissions (demo user switcher)

Use Loan Review sample users (labels vary; typically analyst vs admin-style).

| # | Steps | Expected |
|---|--------|----------|
| G1 | Switch demo user | Status line shows the active user; columns may hide/remap. |
| G2 | User with a **hidden** field | That column does not appear in main (or bottom Aggregate). |
| G3 | User with **view**-only on a field | Formula bar is read-only for that column; typing is rejected with a denial in the status line. |
| G4 | User with **edit** on a field | Formula-bar edits commit normally. |
| G5 | User denied **bottom** region | `#bottom-panel` is hidden / inaccessible. |
| G6 | Switch back to a full-access user | Hidden columns and bottom panel return. |

Repeat G1–G4 on Employee Management after switching workspace.

---

## H. Layout permissions — column resize

| # | Steps | Expected |
|---|--------|----------|
| H1 | As a user allowed to resize: hover main header column edge | Cursor becomes `col-resize`. |
| H2 | Drag the edge | Column width updates live; Aggregate stays width-synced with main. |
| H3 | As a user **without** resize permission | Drag is denied; status shows denial; widths unchanged. |
| H4 | Click **Reset shared widths** as admin-capable user | Widths return to defaults. |
| H5 | Click **Reset shared widths** as a user without modify-shared-layout | Denied; widths unchanged. |

---

## I. Virtualization + 5k rows + rAF paint

| # | Steps | Expected |
|---|--------|----------|
| I1 | On Loan Review, enable **5k rows** | ~5000 rows; scroll host shows a tall spacer / scrollbar. |
| I2 | Scroll rapidly through the grid | Only the viewport paints; no blank flash of “missing” rows once settled; UI stays responsive. |
| I3 | Scroll to row ~2500; check overdue column | Cell is `=B1` (or shows the already-computed value of B1) — off-screen formula was evaluated without needing to be painted first. |
| I4 | (Optional) DevTools Performance while editing a heavily referenced cell | Prefer one paint per region per frame under cascade (rAF scheduler). |
| I5 | Disable **5k rows** | Reloads the small mock-server loan set. |
| I6 | **5k rows** on Employee Management | Toggle is a no-op / does not apply (Loan-only synthetic path). |

---

## J. Search (Find)

| # | Steps | Expected |
|---|--------|----------|
| J1 | Type a substring present in main (e.g. a borrower name) | Status shows `N of M` (or similar); matches highlight. |
| J2 | **Next** / **Prev** (or Enter / Shift+Enter in the search field) | Active match advances; grid scrolls that row into view. |
| J3 | Query with no hits | Status shows no matches. |
| J4 | **Clear** or Escape | Search chrome clears; highlights gone. |
| J5 | Repeat with **5k rows** and a rare token | Scroll-into-view is obvious for far matches. |

---

## K. Form engine removal (regression)

| # | Steps | Expected |
|---|--------|----------|
| K1 | Select different main rows | Nothing appears where a form panel used to be; only main + bottom update. |
| K2 | Edit a main cell | Grid + Aggregate update; no form fields to sync. |
| K3 | Grep the repo / inspect exports | No `buildFormView`, `form.ts`, or public form types on `@gridyard/workspace-runtime`. |

---

## L. Engine features covered by automated tests (no demo chrome yet)

These landed in crates/packages but are **not** exposed as demo toolbar
actions. Confirm with CI / local test commands rather than the browser.

| Feature | Where | How to verify |
|---------|--------|----------------|
| Cell / `Value` model, sparse grid | `gridyard-core` | `cargo test -p gridyard-core` |
| Formula lexer/parser/eval (v0.1 fns) | `gridyard-formula` | `cargo test -p gridyard-formula` |
| Dependency graph / recalc | `gridyard-graph` | `cargo test -p gridyard-graph` |
| WASM workspace API | `gridyard-wasm` | `cargo test -p gridyard-wasm` + demo edits |
| Clipboard copy/cut/paste + formula ref shift | `gridyard-grid` | `cargo test -p gridyard-grid` |
| Sort / filter via `RowView` | `gridyard-grid` | `cargo test -p gridyard-grid` |
| CSV import/export | `gridyard-io` | `cargo test -p gridyard-io` |
| Canvas paint, virtualization, search helpers, rAF scheduler, edit sessions | `@gridyard/grid-renderer` | `npm test -w @gridyard/grid-renderer` |
| Schema parse, binding, REST adapter, permissions | `@gridyard/workspace-runtime` | `npm test -w @gridyard/workspace-runtime` |
| Demo loaders / synthetic 5k / chrome helpers | `web-demo` | `npm test -w web-demo` |

Full workspace:

```bash
make test
# or: cargo test --workspace && npm test --workspaces --if-present
```

---

## M. Smoke checklist before merge

- [ ] `make mock-server` + `make demo` start cleanly
- [ ] A1–A3 layout (no form panel)
- [ ] B1–B3 workspace switch
- [ ] C1–C9 edit path
- [ ] D1–D2 undo/redo
- [ ] E1–E4 Aggregate + F1–F4 Notes
- [ ] G1–G6 permissions
- [ ] H1–H5 resize / reset
- [ ] I1–I3 5k scroll + off-screen formula
- [ ] J1–J5 Find
- [ ] `make test` (or CI) green
