# Gridyard

A business workspace engine: a Rust/WASM spreadsheet-grade grid and
formula core, driven by declarative workspace definitions so new
business screens can be produced from configuration instead of custom
UI code.

See [`docs/00-index-and-vision.md`](docs/00-index-and-vision.md) for the
full vision and architecture, and the rest of `docs/` for the complete
spec set this repo is being built against.

## Status

Pre-MVP. This repository is currently scaffolding only — no engine
code has been written yet. See
[`docs/06-mvp-scope-and-roadmap.md`](docs/06-mvp-scope-and-roadmap.md)
for the phased build plan.

## Layout

- `crates/` — the Rust/WASM engine: cell storage, formula evaluation,
  dependency graph, undo, selection, sort/filter, import/export, and
  the WASM bindings.
- `packages/` — the TypeScript layer: canvas grid renderer, workspace
  runtime (layout/permission/schema), and shared UI components.
- `apps/web-demo` — the app that wires the packages together.
- `docs/` — the full spec set (`00` through `07`).
- `brand/` — logo assets.

## Prerequisites

Rust toolchain with `wasm-pack` or `trunk`, Node.js with npm.

## Getting started

There's nothing to run yet — this is scaffolding, not a working build.
Follow along with `docs/06-mvp-scope-and-roadmap.md` as milestones land.

## License

Licensed under Apache-2.0. See [`LICENSE`](LICENSE).
