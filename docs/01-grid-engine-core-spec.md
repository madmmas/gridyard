# Grid Engine Core Spec

## Deliverable

A Rust crate, compiled to WASM, providing cell storage, formula
evaluation, dependency tracking, undo/redo, selection, clipboard,
sorting, and filtering. This is the "model" and engine layer — it holds
no rendering or DOM code.

## Why Rust for this layer

The expensive parts of a spreadsheet engine are not rendering — they
are: recalculation, dependency graph traversal, huge datasets, formula
parsing, sorting, filtering, undo, diffing, and serialization. These are
exactly where Rust excels.

The UI layer should remain JavaScript/TypeScript (React, SolidJS, or
Svelte) — do not implement DOM rendering in Rust. Rust is the backend;
the UI ecosystem is simply better in JS frameworks.

## Internal data model

Conceptually the data is a spreadsheet containing sheets, containing
rows, containing cells — but it should not actually be stored in that
nested shape. Store cells in a flat, sparse map keyed by a cell
identifier, so only non-empty cells consume memory.

The cell identifier should not be a string like "A1" — encode it as a
single packed integer (row shifted into the high bits, column in the low
bits) for fast hashing and equality checks instead of string parsing.

Each cell holds three things: its current value, an optional formula
reference, and a reference to a shared style entry (not an inline style
— see the styling section below).

Values can be one of: empty, a number, a string, a boolean, an error (of
a specific error type), or a date.

## Formula engine

A formula such as `=SUM(A1:A10)+B5` is parsed into an abstract syntax
tree — for example, a binary "+" expression whose two operands are the
SUM(A1:A10) call and the B5 reference.

Pipeline: lexer produces tokens, parser turns tokens into an AST, the AST
is turned into an execution plan, and the plan is evaluated against the
current sheet state.

### Formula library

Target function set to start with, growing toward several hundred over
time: SUM, COUNT, AVERAGE, IF, AND, OR, VLOOKUP, XLOOKUP, MATCH, INDEX,
TEXT, LEFT, RIGHT, LEN, CONCAT, DATE, NOW, RAND, UNIQUE, FILTER, SORT.

## Dependency graph

Every formula reference becomes an edge in a dependency graph — if B5
depends on A1, and C10 depends on B5, then a change to A1 must be able to
propagate through B5 to C10. Only affected (dependent) nodes should ever
recalculate — this is exactly how Excel works internally.

## Recalculation

Never recompute the entire sheet. On a cell change: mark that cell dirty,
mark all of its dependents dirty (transitively), topologically sort the
dirty subset, then recompute in that order.

## Cell selection

Selection state should not live in the UI layer — it belongs inside the
Rust core, tracked as a start cell, an end cell, an anchor cell, and
support for multiple simultaneous ranges (multi-selection).

## Clipboard

Support copy, cut, paste, fill-handle drag, and multi-selection copy/
paste.

## Undo

Do not snapshot the full sheet state on every edit. Use a command
pattern instead: each edit is recorded as a command with a matching
inverse command, pushed onto a stack. Undo pops and applies the inverse;
redo re-applies the original. This keeps memory usage tiny regardless of
sheet size.

## Data storage

Do not store the sheet as JSON on disk or in memory for persistence —
use a binary format instead. Candidates: MessagePack, Bincode,
Flatbuffers, or Cap'n Proto.

## Huge datasets

100,000, 500,000, and 1 million row sheets should all still scroll
smoothly. This requires viewport virtualization, row virtualization, and
column virtualization (the rendering strategy itself is covered in
`02-rendering-layer-spec.md`).

## Sorting

Rust's sort is extremely fast. Sort only the row index/order list — never
move or copy the underlying cell objects themselves.

## Filtering

Maintain a separate "visible rows" list rather than deleting or
relocating rows — filtering should be a view over the data, not a
mutation of it.

## Search

Build a search index ahead of time so lookups avoid a full linear scan;
the flow is: index, then search, then highlight matches.

## Styling

Do not store style information inline on every cell — that duplicates
data unnecessarily. Instead, each cell references a shared style entry by
ID, and the actual style definitions (fonts, colors, formats) live in one
shared style table. This mirrors how Excel itself avoids duplicating
style data per cell.

## Multi-threading

Rust WASM supports threads when the browser's security headers (COOP/
COEP) permit it. Keep one thread dedicated to the UI; use worker threads
for formula calculation, import, export, sorting, and filtering.

## Import

Support xlsx, csv, and ods import. Rust already has libraries for these
formats.

## Export

Support xlsx, csv, pdf, and json export.

## Performance checklist

- Sparse storage for non-empty cells only.
- Row and column virtualization.
- Dirty-only dependency graph recalculation, never a full recompute.
- Arena allocation for formulas and ASTs (avoid per-node heap
  allocation).
- String interning to reduce duplicate text storage.
- Style deduplication via shared style IDs.
- Binary serialization for persistence.
- Batched rendering driven by requestAnimationFrame (renderer side).
- Offload heavy operations to Web Workers.

## Recommended crates

wasm-bindgen, web-sys, serde, slotmap or generational-arena, petgraph
(dependency graph), rayon (native builds; worker-based parallelism for
WASM), bincode or postcard (binary serialization).
