# Contributing

Gridyard is pre-public and not yet accepting outside contributions —
this document will expand once Phase 1 lands and the project actually
opens up. For now this covers local setup for reference.

## Repo structure

- `crates/` — Rust/WASM engine, one crate per concern (`gridyard-core`,
  `gridyard-formula`, `gridyard-graph`, `gridyard-grid`, `gridyard-io`,
  `gridyard-wasm`). Only `gridyard-wasm` depends on `wasm-bindgen`/
  `web-sys` — everything else is plain, natively testable Rust.
- `packages/` — TypeScript packages (`@gridyard/grid-renderer`,
  `@gridyard/workspace-runtime`, `@gridyard/ui-kit`).
- `apps/web-demo` — the demo app that wires the packages together.
- `docs/` — the spec set this repo is built against.

## Dev setup

Rust: install via [rustup](https://rustup.rs), then `wasm-pack` or
`trunk` for the WASM build.

Node: any recent LTS, npm workspaces are used at the repo root (see
`package.json`).

### Git hooks

Point Git at the repo-managed hooks (once per clone):

```bash
git config core.hooksPath .githooks
```

`pre-commit` runs the same floor as CI: `cargo fmt`, `clippy`,
`cargo test`, plus `npm` lint/test across workspaces. To skip once
(emergency only): `SKIP_HOOKS=1 git commit ...`.

## Before opening a PR

Run the Rust checks (`cargo fmt --check`, `cargo clippy`, `cargo test`)
and the JS checks (`npm run lint`, `npm run build`) across the whole
workspace — see `.github/workflows/ci.yml` for the exact commands CI
runs. With hooks enabled, most of that already runs on every commit.
