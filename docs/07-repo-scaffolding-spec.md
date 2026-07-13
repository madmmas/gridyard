# Repo Scaffolding Spec — Gridyard

## Deliverable

Initialize the Gridyard git repository: directory structure, license,
README, contributor docs, ignore rules, and CI — ready to receive the
crates and packages described in specs `01` through `06`. No engine
logic is implemented in this step; this is scaffolding only.

## Repository identity

Project name: **Gridyard**.

Suggested home: a dedicated GitHub organization named `gridyard`
(confirmed available), rather than a personal-account repo. Even solo,
an org keeps room for additional repos later (core engine, CLI, docs
site, examples) without a rename or migration.

Repository: a single monorepo named `gridyard` at
`github.com/gridyard/gridyard` for the MVP phase. Splitting into
multiple repos can happen later once there's an actual reason to (for
example, a separate docs site or examples repo).

Default branch: `main`.

## Directory structure

Recreate the layout from specs `01`–`06` inside the new repo root, with
real names applied:

Rust crates (workspace members under `crates/`): `gridyard-core`,
`gridyard-formula`, `gridyard-graph`, `gridyard-grid`, `gridyard-io`,
`gridyard-wasm`. Each starts as an empty crate skeleton — a name, a
one-line description, and no implementation yet.

TypeScript packages (under `packages/`), scoped under `@gridyard/`:
`@gridyard/grid-renderer`, `@gridyard/workspace-runtime`,
`@gridyard/ui-kit`. Each starts as an empty package skeleton.

Apps (under `apps/`): `web-demo`, an empty Vite app skeleton that will
eventually wire the packages together.

Docs (`docs/`): copy spec files `00` through `07` into this folder as
the living reference documentation, so anyone cloning the repo —
including Cursor in a future session — has the specs available in-repo
rather than only in chat history.

Repo-root files: `README.md`, `LICENSE`, `NOTICE`, `.gitignore`,
`CONTRIBUTING.md`, and a CI workflow under `.github/workflows/`.

## License

Apache License 2.0.

Add a `LICENSE` file at the repo root containing the full, unmodified
Apache-2.0 license text. Add a `NOTICE` file at the repo root (standard
Apache-2.0 convention) stating the project name, copyright year, and
copyright holder — this is also where attribution for any bundled
third-party Apache-licensed code would go later, if that ever applies.

Every crate's manifest and every package's manifest should declare the
license as Apache-2.0 directly (not just rely on the root LICENSE file),
so dependency tooling and license scanners pick it up automatically.

Skip per-file license header comments for now — common in larger Apache
projects, but unnecessary noise at this stage. Revisit once the project
is public and accepting outside contributions.

## README

Cover, in order: a one-line description (the business workspace
engine — spreadsheet-grade performance, declarative workspace
definitions), a short "why" that points at `00-index-and-vision.md`
rather than duplicating it, a status line noting this is pre-MVP and
under active development, a link into `docs/` for the full spec set,
prerequisites (Rust toolchain, Node/pnpm, wasm-pack or trunk), and a
license line referencing Apache-2.0 and the LICENSE file.

Keep it short, and do not write install or usage instructions yet —
there's no working build to install until Phase 1 lands. A placeholder
"Getting Started" section should say that explicitly rather than
describing steps that don't work yet.

## .gitignore

Exclude, at minimum: Rust build artifacts (target/ directories across
all crates), Node artifacts (node_modules/, dist/, build/ in every
package and app), WASM build output, editor and OS noise (.DS_Store,
.idea/, and .vscode/ unless intentionally shared), and environment files
(.env, .env.local).

## Contributor docs

`CONTRIBUTING.md` can stay minimal for now: how to set up the dev
environment, how the monorepo is organized (crates vs. packages vs.
apps), and a note on current contribution stance (for example, pre-public
and not yet accepting outside PRs, if that's the case). Expand this once
Phase 1 lands and the project actually opens up.

A `CODE_OF_CONDUCT.md` is optional at this stage since the repo isn't
public yet. Add the Contributor Covenant — the de facto standard, and a
natural pairing with an Apache-2.0 project — before actually inviting
outside contributors, not before.

## Continuous integration

Run on every push and pull request to `main`, with two independent jobs:

A Rust job: format check, lint (clippy), and test, run across the whole
Cargo workspace.

A JS/TS job: install dependencies, lint, and build, run across the whole
package/app workspace.

Keep it to these two jobs for now. No deployment, no publishing, no
release automation — those come later, once there's something worth
shipping (post Phase 1).

## Initial commit sequence

Recommended order, so the repo's history starts clean rather than as one
combined dump:

1. Initialize the repo with README, LICENSE, NOTICE, and .gitignore
   only.
2. Add the empty Cargo workspace (root workspace manifest plus the six
   empty crate skeletons).
3. Add the empty JS/TS workspace (root workspace manifest plus the
   three empty package skeletons and the web-demo app skeleton).
4. Add docs/ with the spec files copied in.
5. Add the CI workflow.
6. Add CONTRIBUTING.md.

Each step can be its own commit, or its own small PR even solo, for a
history that's easy to read back later.

## Repo metadata

Once created on GitHub: set the repository description to a one-line
summary matching the README, add topics for discoverability (for
example: rust, webassembly, wasm, spreadsheet, low-code,
business-applications), and leave the repo private until Phase 1's
success criteria (from `06-mvp-scope-and-roadmap.md`) are met — going
public before there's a working demo mainly risks losing the name to
someone forking an empty scaffold.

## Out of scope for this spec

Reserving the `gridyard` npm organization scope and any domain (for
example gridyard.dev or gridyard.io) are account-creation and purchase
actions outside what repo scaffolding — or Cursor — should handle.
Those are manual steps to do directly when ready to publish the first
real package.
