# Rendering Layer Spec

## Deliverable

A TypeScript rendering package ("renderer") that draws the grid UI,
virtualizes rows and columns, and talks to the Rust/WASM core for data.
No data storage, formula evaluation, or dependency logic lives here —
that all belongs to `01-grid-engine-core-spec.md`.

## Virtual rendering

This is the single biggest performance trick in the whole system. Never
render the full dataset — for example, never render all 1,048,576 rows
of a sheet. Render only what's visible on screen, for example roughly 40
rows by 20 columns; everything outside the viewport is virtual until it
is scrolled into view. This is how Excel, Google Sheets, and VS Code all
work internally.

This applies along both axes independently:

- viewport virtualization
- row virtualization
- column virtualization

## Canvas over DOM

Prefer Canvas rendering instead of DOM elements. Excel does not render
millions of individual elements — Canvas can render tens of thousands of
visible cells efficiently in a single draw pass. WebGL is a possible
later upgrade once Canvas performance is validated.

## Frontend stack

React or SolidJS, TypeScript, Canvas rendering (WebGL later), Vite.

## Batching

Use requestAnimationFrame to batch drawing work rather than redrawing
synchronously on every input or scroll event — accumulate input and
paint once per frame.

## Search UI

Search should use the index built by the core engine
(`01-grid-engine-core-spec.md`) rather than scanning cells directly from
the renderer. The renderer's job is presenting and highlighting results,
not computing them.
