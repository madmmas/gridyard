# 08 — Tooling and CI Hardening — Instructions for Cursor

## Goal

Close the gap between what CI/rules claim to enforce and what's actually
wired up. Found via an audit of the pushed repo
(https://github.com/madmmas/gridyard): CI's JS/TS lint step is a silent
no-op (no `lint` script anywhere, no ESLint config anywhere), there's no
`tsconfig.json` anywhere despite "strict mode, no any" being a stated
convention in `.cursor/rules/020-typescript.mdc`, no Rust toolchain
pinning, no rustfmt/clippy config, no dependency-vulnerability scanning,
and `Cargo.toml`'s `repository` field points at a URL that doesn't exist.

This is a straight task list. Implement each numbered section as its own
commit, run `make check` after each one to confirm it's still green, and
for the lint/typecheck sections specifically, verify the new gate is real
by intentionally breaking something (an `any`, an unformatted file) and
confirming `make check` actually goes red before reverting the break.

## 1. Fix the wrong repository URL

`Cargo.toml`'s `[workspace.package] repository` field says
`https://github.com/gridyard/gridyard`, which doesn't exist. The real repo
is `https://github.com/madmmas/gridyard`. Fix it there, and grep the repo
(`README.md`, `NOTICE`, any `package.json`) for the same wrong URL and fix
every occurrence.

## 2. Add TypeScript config with strict mode actually enforced

Nothing currently type-checks TS in this repo — there is no
`tsconfig.json` anywhere.

- Add a root `tsconfig.base.json`: `"strict": true`,
  `"noUncheckedIndexedAccess": true`, `"module": "ESNext"`,
  `"target": "ES2022"`, `"moduleResolution": "Bundler"`.
- Add a `tsconfig.json` in each of `packages/grid-renderer`,
  `packages/workspace-runtime`, `packages/ui-kit`, and `apps/web-demo`
  that extends the base config and scopes `include` to its own `src/`.
- Add a `"typecheck": "tsc --noEmit"` script to every package/app's
  `package.json`.

## 3. Wire up a real lint step

CI's and the Makefile's lint targets run
`npm run lint --workspaces --if-present` against packages that have no
`lint` script and no ESLint config anywhere in the repo — `--if-present`
silently skips them, so CI passes green while linting nothing.

- Add `eslint`, `typescript-eslint`, and `eslint-plugin-import` (or
  current recommended equivalents) as root devDependencies.
- Add a root `eslint.config.js` (flat config) using
  `typescript-eslint`'s `strict-type-checked` preset, plus an explicit
  `"@typescript-eslint/no-explicit-any": "error"` rule since that's the
  stated project convention.
- Add a `"lint": "eslint ."` script to every package/app's `package.json`
  so `--workspaces --if-present` actually finds something to run.

## 4. Add a typecheck step to CI

Add a step to the `js` job in `.github/workflows/ci.yml`, after install
and before lint: `npm run typecheck --workspaces --if-present`. Add the
same target to the Makefile (either fold into `lint-js` or add a
dedicated `typecheck-js` and include it in `check`).

## 5. Pin the Rust toolchain

Add `rust-toolchain.toml` at the repo root pinning an explicit stable
version rather than a floating `stable`, so local builds and CI stay
reproducible and clippy doesn't silently gain new lints on some future CI
run.

```toml
[toolchain]
channel = "<current-stable-version>"
components = ["rustfmt", "clippy"]
```

## 6. Add rustfmt.toml and clippy.toml

- `rustfmt.toml`: set explicit options rather than relying on rustfmt's
  defaults, so formatting can't silently shift if the defaults change in
  a future rustfmt release.
- `clippy.toml`: start minimal (e.g. `avoid-breaking-exported-api = true`)
  — mainly a placeholder that signals intent and gives a place to add
  crate-specific thresholds later.

## 7. Add workspace-wide lint levels in Cargo.toml

Add a `[workspace.lints]` table to the root `Cargo.toml` so warnings are
caught on a plain `cargo check`/`cargo build`, not only when clippy runs
explicitly in CI:

```toml
[workspace.lints.rust]
unsafe_code = "forbid"
missing_docs = "warn"

[workspace.lints.clippy]
all = "warn"
```

Then add `[lints]` with `workspace = true` to each of the six crates'
`Cargo.toml` files so they inherit it. None of the crates should need
`unsafe` — confirm that's still true; only `gridyard-wasm` touches the
WASM boundary, and ordinary `wasm-bindgen` usage doesn't require raw
`unsafe`.

## 8. Add dependency-vulnerability scanning

- Add `deny.toml` (for `cargo-deny`) covering advisories, a license
  allow-list (Apache-2.0/MIT-compatible), and duplicate-version warnings.
- Add a step to the CI `rust` job: install `cargo-deny` and run
  `cargo deny check`.
- Add `npm audit --audit-level=high` as a step in the CI `js` job — no
  extra tool needed for this one.

## 9. Add Dependabot

Add `.github/dependabot.yml` with two update blocks — one
`package-ecosystem: cargo`, one `package-ecosystem: npm` — both targeting
`main`, weekly interval.

## 10. Optional, lower priority

- `SECURITY.md` — even a one-paragraph placeholder on how to report a
  vulnerability.
- `.github/CODEOWNERS` — not urgent solo, cheap to add once a second
  contributor joins.
- Consider bumping `edition` from `2021` to `2024` now that it's stable,
  if there's no specific reason to stay conservative.

## Verification

After every numbered section: `make check` should stay green. For
sections 2–4 specifically, prove the new gate is real (not just present)
by breaking something on purpose — an `any`, an unformatted file, an
unused import — and confirming `make check` fails, then revert the break.
Commit each section separately so the history stays reviewable, matching
the existing commit granularity in this repo.
