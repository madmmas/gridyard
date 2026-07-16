# Layout, Permission, and Data Binding Engine Spec

## Deliverable

The "layout", "permissions", and "adapters" modules — composing
workspace regions (main and bottom grids), enforcing access rules, and
connecting to data sources.

## Current product focus

Gridyard’s workspace UI is **main + bottom grid regions** (with bottom’s
Aggregate and Notes tabs). That is the surface to build, demo, and
harden. A structured **form engine** (record-as-form panels alongside the
grid) is **out of scope** for the current product — see “Form engine
(out of scope)” below. Existing form code and schema fields may remain
until removed by a tracked cleanup issue; they must not drive new work.

## Layout engine

Controls how different workspace regions are composed. Supported
regions: header, main content, sidebar, footer, floating panels, tabs,
and dialogs.

A typical composition: a toolbar spanning the top, a main data grid
occupying most of the width with a notes panel alongside it, and a
footer strip below holding summary figures and actions. Each region can
have independent behavior — for example, the sidebar can scroll
independently of the main grid.

### Dimension-synced grid regions

A workspace composes two grid regions: main, and bottom — dimensionally
related to each other without being merged into one frozen-pane
spreadsheet.

A bottom region set to sync on columns takes the main grid's column
widths so each of its columns lines up vertically with the corresponding
main grid column. This is where column-level aggregation lives — totals,
averages, counts — one aggregate value per column, computed over
whatever rows are currently visible or filtered in the main grid.

The two regions stay visually separate: their own border, their own
background, their own header label, with a real gap between them — never
sharing a border or scroll surface the way spreadsheet frozen panes do.
Only bottom's column widths are coupled to main; everything else about
each region — its own header content, its own scrolling, its own data
source — is independent.

Earlier drafts of this spec had two additional regions, side (row-synced
to main, for row-specific notes) and corner (unsynced, for
workspace-level notes). Side was dropped; corner's purpose — freeform,
unsynced notes and document references — was folded into bottom as a
second tab instead of staying a separate region. See "Tabs within a
region" below.

### Tabs within a region

A region can hold more than one tab, switching which content is shown
without changing the region's position, size, or header. Bottom has two
tabs:

**Aggregate** — the column-synced grid described above: totals,
averages, and other per-column aggregates, one row per aggregate,
columns locked to main's widths.

**Notes** — a plain, unsynced label-value list for workspace-level notes
and document references, the same content that used to live in the
standalone corner region. Switching to this tab doesn't change bottom's
outer width (still matched to main) since that's a property of the
region, not of whichever tab happens to be active — only the tab's own
internal content differs.

Only one tab is visible at a time; switching tabs is a pure display
toggle, not a navigation — the region's add-row/add-column controls
(below) always apply to whichever tab is currently active.

### Add-row / add-column controls

Each region — main and bottom — carries its own pair of controls: an
add-column control at the top-right of its header row, and an add-row
control at the bottom-left, just below its last row. These controls are
per-region (and, for a tabbed region, per-active-tab), not global to the
workspace. Adding a column or row to bottom never adds one to main:

Adding a row to bottom's Aggregate tab does not add a row to main — the
tab is free to grow to multiple rows of its own (for example Total,
Average, and Max stacked) while every column still lines up in width
with the corresponding main grid column.

Bottom's Notes tab behaves like a plain, unsynced grid — new rows and
columns there don't affect, and aren't affected by, sizing in main or in
the Aggregate tab.

### Spreadsheet-style headers and formula cells

Main and bottom's Aggregate tab are real spreadsheet grids, not just
styled tables — each renders two header rows above the data: a
reference row (A, B, C, D…, matching standard spreadsheet column
letters) and a name row beneath it holding the human-readable field name
(Borrower, Overdue, and so on). A row-number gutter runs down the left
edge the same way, giving every cell a standard A1-style address. Cells
in both accept formulas — written and evaluated through the formula
engine in `01-grid-engine-core-spec.md` — the same way a cell in any
spreadsheet does.

Bottom's Aggregate tab reuses main's exact column letters and names
since its columns are synced to main's — column A in bottom is the same
field as column A in main, just aggregated. Bottom's row numbers are its
own, independent of main's, since only its columns are synced.

Bottom's Notes tab is the deliberate exception: no reference row, no
name row, no row-number gutter, and no formula support. It's a plain
label-value list — meaningful specifically because it isn't another
formula grid, just a place for freeform notes and document references
that don't belong to any row, column, or cell address.

### Cross-region formula references

Bottom's Aggregate tab can reference cells in main as well as cells
within itself — a formula there can pull from main's rows (for example
an aggregate over `main!B2:B8`) or from another cell in the Aggregate
tab. Main and bottom each evaluate their own formulas separately —
there's no single merged dependency graph across both, each keeps its
own, with cross-region references resolving as reads into the other
region's current values.

How far cell editing should be restricted (versus fully free-form the
way Excel is, which is both its biggest strength and its biggest source
of error) is intentionally left undecided for now — revisit once the
formula engine and cross-region referencing are actually built and there's
real usage to reason about, rather than deciding upfront.

## Form engine (out of scope)

**Not in current scope.** Earlier drafts described displaying the same
underlying data as a structured form (sections, field groups, conditional
fields, validation) alongside or instead of the grid — for example a
customer-information form with multiple sections.

That path is **deferred indefinitely / removed from the product focus**.
Do not expand form schema, form rendering, or form chrome in the demo.
New layout and permission work should assume **main and bottom grids
only**. If a form surface is revisited later, it should be a fresh
spec revision, not silent revival of this section.

Historical note: Batch 04 issue #49 / PR #56 shipped a first form-engine
slice; removing that implementation from the runtime and demo is tracked
separately (Batch 06).

## Permission engine

Permissions need to exist beyond simple page-level access, at four
levels:

**Workspace permissions** — who can access a given workspace at all.

**Region permissions** — who can access specific regions, such as the
main grid, sidebar, footer, or reports panel.

**Field permissions** — per-field settings such as view, edit, or
hidden.

**Layout permissions** — settings such as whether a user can resize
columns, whether a user can personalize their own view, or whether only
administrators can modify a shared layout.

### Permission inheritance

Permissions and layout customization should be layered rather than
forked, following the same shape as the core/company/department/user
extension model: a core definition, overridden by a company-level
extension, overridden by a department-level extension, overridden by an
individual user's personal preferences — without ever needing to fork
the underlying workspace definition.

## Data binding engine

The workspace connects to different data sources. Possible adapters:
REST APIs, GraphQL, database queries, local storage, files, and event
streams.

The workspace should understand a consistent binding chain from a data
object, to a field on that object, to the cell or component that
displays it — for example, a binding path like customer.name,
customer.address, or customer.orders resolves through that same chain
regardless of which adapter is supplying the underlying data.
