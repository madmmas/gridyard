# Seventh issue batch — styling, persistence, and extensibility

**Batch status (2026-07-15):** Filed as GitHub issues #75–#80. Docs-only —
no implementation yet (manual UI check of prior work first).

| Batch § | GitHub | Title | PR |
|---------|--------|-------|----|
| 32 | [#75](https://github.com/madmmas/gridyard/issues/75) | Real styling engine | — |
| 33 | [#76](https://github.com/madmmas/gridyard/issues/76) | Write-back — edits persist to the mock server | — |
| 34 | [#77](https://github.com/madmmas/gridyard/issues/77) | xlsx export | — |
| 35 | [#78](https://github.com/madmmas/gridyard/issues/78) | Workspace save/load (binary serialization) | — |
| 36 | [#79](https://github.com/madmmas/gridyard/issues/79) | Custom cell types — first slice | — |
| 37 | [#80](https://github.com/madmmas/gridyard/issues/80) | First real shared component — status badge | — |

Correction: this was originally written as `ISSUES_BATCH_06.md`, §31–§36,
without knowing the repo already had its own Batch 06 file — dedicated
entirely to tracking the form-engine removal (§31, "Remove form engine
from product scope," issue #72, PR #74, already done, per
`docs/ISSUES/ISSUES_BATCH_06.md`). Renumbered to §32–§37 and renamed to
Batch 07 to not collide with that file or its numbering.

Batch 05 (§25–§30) closed the demo-wiring and remaining crate slices.
Batch 06 (§31) removed forms from scope — `form.ts`, the demo's form
panel, and form-related fixture/schema fields are gone; `docs/04`'s form
section is marked out of scope; `docs/MANUAL_TESTING.md` was added
alongside it. Zero open issues as of this check.

With forms cut and the main+bottom grid loop functionally complete
(interactive, permissioned, data-bound, virtualized, searchable, with
clipboard/sort/filter/undo/redo and CSV export), what's left splits into
two kinds of gap: things the engine still fakes rather than really does
(styling is a bare `StyleId` placeholder from batch 1 that's never had
real content; the "loan status" pills in the demo are hardcoded CSS
classes, not the engine's own styling; edits never persist past a page
reload since the REST adapter was deliberately scoped read-only), and
things named in the spec docs that have never been started at all
(`gridyard-io`'s xlsx export, workspace persistence, custom cell types
and the plugin registry from `docs/05` — the reason `ui-kit` still sits
completely untouched since scaffolding).

---

## 32. [gridyard-core] Real styling engine

**Status:** open — issue [#75](https://github.com/madmmas/gridyard/issues/75)

### Spec reference
`docs/01-grid-engine-core-spec.md` — Styling section.

### Context
`Cell` has carried a `StyleId` field since batch 1's issue #1, explicitly
scoped then as "a placeholder" — there's never been an actual style
table behind it. Meanwhile the demo's status pills (overdue/active/closed
in the loan grid) are hardcoded CSS classes applied outside the engine,
not real cell styling — meaning nothing built so far actually exercises
`StyleId` for anything.

### Scope
**In scope:**
- A real style table: number/text formatting (currency, date, percentage), and basic visual attributes (bold, text color, background color)
- Style deduplication — identical styles share one `StyleId`, per the original spec intent, not one style object per cell
- `grid-renderer` reads real styles when painting instead of any hardcoded per-value color logic

**Out of scope:**
- Conditional formatting rules (e.g. "highlight red if overdue") — that's a rules engine on top of styling, worth its own issue once basic styling exists
- Style editing UI — this issue is the engine + read path; an editing UI for styles can follow

### Acceptance criteria
- [ ] Setting a style on a cell and reading it back returns the correct formatted display value (e.g. a currency-formatted number)
- [ ] Two cells with identical style attributes share the same `StyleId` rather than allocating duplicates
- [ ] `grid-renderer`'s existing status-pill display can be reimplemented using real cell styles instead of hardcoded value-based CSS class logic

### Testing requirements
- [ ] Table-driven tests: style dedup, each format type, style-to-display-value conversion
- [ ] `cargo fmt --check && cargo clippy -- -D warnings && cargo test --workspace` passes

### Notes
None yet.

---

## 33. [workspace-runtime] Write-back — edits persist to the mock server

**Status:** open — issue [#76](https://github.com/madmmas/gridyard/issues/76)

### Spec reference
`docs/04-layout-and-permission-engine-spec.md` — Data binding engine.

### Context
The REST adapter (batch 2) was deliberately scoped read-only. Every edit
in the running demo since then has been in-memory only — reload the page
and everything reverts to the fixture data. This is the last piece needed
for the demo to behave like a real (if mock-backed) application rather
than a session-only sandbox.

### Scope
**In scope:**
- Committing a cell edit (from the existing formula-bar/type-to-edit flow) issues a write to the mock server (`json-server` supports `PATCH`/`PUT` out of the box) for the corresponding record/field
- Respects the field-level `edit` permission from the permission engine — a write is never attempted for a field the current user can't edit, as a second guard beyond the UI already blocking it
- A failed write (mock server down, network error) surfaces clearly and doesn't silently lose the in-memory edit

### Acceptance criteria
- [ ] Editing a cell and reloading the page shows the edited value, not the original fixture value
- [ ] A write attempt for a permission-denied field never reaches the network layer
- [ ] A failed write shows a clear error state and doesn't leave the UI showing a value that wasn't actually saved

### Testing requirements
- [ ] Vitest tests against a mocked fetch: successful write, permission-blocked write, failed write handling
- [ ] `npm test --workspaces --if-present` and typecheck pass
- [ ] Manual: edit a cell, reload the demo, confirm persistence — add this to `docs/MANUAL_TESTING.md`'s checklist

### Notes
None yet.

---

## 34. [gridyard-io] xlsx export

**Status:** open — issue [#77](https://github.com/madmmas/gridyard/issues/77)

### Spec reference
`docs/01-grid-engine-core-spec.md` — Import/export; `gridyard-io`'s own doc comment ("CSV now, xlsx later").

### Context
CSV landed in batch 5; the crate's doc comment has named xlsx as the
deferred second format since scaffolding. Export only for this issue —
xlsx import is a larger parsing surface and can be its own follow-up.

### Scope
**In scope:**
- Export a region's current computed values to a valid `.xlsx` file (a pick of a well-maintained Rust xlsx-writing crate is expected here — check `deny.toml`'s license allow-list from the tooling-hardening work before adding the dependency)
- Preserve at least basic styling from issue #32 in the export (number formats, bold) if that issue has landed first — otherwise export values only and note styling as a follow-up in this PR

**Out of scope:**
- xlsx import
- Multi-sheet export (main + bottom as one workbook with two sheets) — single-region export for this issue; multi-sheet can follow once this works

### Acceptance criteria
- [ ] Exported `.xlsx` opens correctly in standard spreadsheet software with correct values
- [ ] Numbers, text, and booleans round-trip with correct types (not everything coerced to text)
- [ ] New dependency passes `cargo deny check` against the existing license allow-list

### Testing requirements
- [ ] Tests verifying the generated file's structure/values (via whatever xlsx-reading capability the chosen crate or a lightweight secondary crate provides for test assertions)
- [ ] `cargo fmt --check && cargo clippy -- -D warnings && cargo test --workspace` passes

### Notes
None yet.

---

## 35. [gridyard-io] Workspace save/load (binary serialization)

**Status:** open — issue [#78](https://github.com/madmmas/gridyard/issues/78)

### Spec reference
`docs/01-grid-engine-core-spec.md` — Storage/binary serialization formats.

### Context
Distinct from issue #33's write-back (which persists individual field
edits to the mock server): this is whole-workspace save/load — capturing
a full workspace's state (both regions, all cells, undo history if
practical) into a single binary blob that can be reloaded later,
independent of any backend.

### Scope
**In scope:**
- Serialize a full workspace (main + bottom, both tabs) to a compact binary format
- Deserialize it back into an equivalent working state — recalculation should produce the same computed values as before serialization
- Version the format from the start (a format tag/version byte) so future changes don't silently corrupt old saves

### Acceptance criteria
- [ ] Save → load round trip produces a workspace with identical cell contents and computed values
- [ ] Loading a save produced by a different format version fails clearly rather than corrupting or silently misreading
- [ ] Serialized size is reasonably compact for a sparse grid — not proportional to a dense grid's theoretical cell count

### Testing requirements
- [ ] Table-driven tests: round-trip for various sparse patterns, version-mismatch rejection, empty-workspace edge case
- [ ] `cargo fmt --check && cargo clippy -- -D warnings && cargo test --workspace` passes

### Notes
None yet.

---

## 36. [gridyard-core, grid-renderer] Custom cell types — first slice

**Status:** open — issue [#79](https://github.com/madmmas/gridyard/issues/79)

### Spec reference
`docs/05-extensions-plugins-ai-spec.md` — Custom cell types.

### Context
First real slice of `docs/05`, otherwise entirely untouched. Rather than
building the general plugin/registry system up front, this issue proves
the concept with two concrete types that the existing fixtures already
need: Date (loan due dates) and Currency (loan amounts, currently plain
numbers with ad hoc `$` formatting in the demo, not a real cell type).

### Scope
**In scope:**
- A `CellType` concept distinct from `Value`'s raw type (a `Value::Number` can be typed as `Currency` or plain `Number`, affecting display/coercion without changing the underlying stored value)
- Date and Currency as the two concrete types for this issue
- `grid-renderer` renders each according to its type (currency symbol + decimals, date formatting) instead of the demo's current hardcoded formatting

**Out of scope:**
- A general plugin registry for third-party-defined cell types — this issue hardcodes two types to prove the concept; the registry is a larger follow-up once there's a second consumer of the pattern
- Cell-type-aware input validation beyond basic parsing (e.g. rejecting an invalid date string) — keep validation minimal for this slice

### Acceptance criteria
- [ ] A cell typed as Currency displays with currency formatting and still participates correctly in `SUM`/`AVERAGE` as a plain number underneath
- [ ] A cell typed as Date displays as a formatted date and sorts correctly (issue #28's sort) by actual date value, not string comparison
- [ ] The demo's loan amounts and due dates use real cell types instead of the current hardcoded display formatting

### Testing requirements
- [ ] Table-driven tests: type-aware display formatting, type-aware sort ordering, formulas still operate on underlying values correctly regardless of type
- [ ] `cargo fmt --check && cargo clippy -- -D warnings && cargo test --workspace`, plus `npm test --workspaces --if-present` for the renderer side

### Notes
None yet.

---

## 37. [ui-kit] First real shared component — status badge

**Status:** open — issue [#80](https://github.com/madmmas/gridyard/issues/80)

### Spec reference
`docs/05-extensions-plugins-ai-spec.md` (shared UI components), `ui-kit`'s own doc comment.

### Context
`ui-kit` has been an empty `export {}` since scaffolding — nothing has
ever needed a shared component badly enough to start it. The demo's
status pills (overdue/active/closed) are currently hardcoded CSS classes
inline in `web-demo`/`grid-renderer`, duplicating what should be one
reusable component.

### Scope
**In scope:**
- A `StatusBadge` (or similarly named) component in `ui-kit`, taking a status/variant and label, used to replace the demo's inline pill markup
- No new dependencies — plain enough to not need a UI framework decision this early

**Out of scope:**
- A broader component library — this issue exists to stop `ui-kit` being permanently empty and to deduplicate one real, currently-duplicated piece of UI, not to design a whole system

### Acceptance criteria
- [ ] The demo's existing status pills are replaced with `ui-kit`'s component, with no visual regression
- [ ] The component has no dependency on `grid-renderer` internals — genuinely reusable, not grid-specific despite starting from a grid use case

### Testing requirements
- [ ] Vitest tests for the component's variant/label rendering logic
- [ ] `npm test --workspaces --if-present` and typecheck pass

### Notes
None yet.
