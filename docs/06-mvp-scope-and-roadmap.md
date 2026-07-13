# MVP Scope and Development Roadmap

## MVP principle

Do not start with a full ERP — it is a huge domain spanning accounting,
inventory, payroll, manufacturing, CRM, compliance, and taxation. Build
the thing ERP vendors struggle with instead: the adaptation layer. The
first milestone should prove exactly one thing — that a business user
can get a new screen or workflow without a developer.

## MVP architecture

Keep the first version deliberately small, made of six modules:

- **renderer** — canvas-based grid (see `02-rendering-layer-spec.md`)
- **model** — rows, columns, cells (see `01-grid-engine-core-spec.md`)
- **schema** — JSON/YAML workspace definition (see
  `03-workspace-schema-spec.md`)
- **permissions** — view/edit rules (see
  `04-layout-and-permission-engine-spec.md`)
- **layout** — main, footer, sidebar composition (see
  `04-layout-and-permission-engine-spec.md`)
- **adapters** — REST, JSON, mock data (see
  `04-layout-and-permission-engine-spec.md`)

Explicitly excluded from the MVP: no formulas, no AI, no ERP domain
logic. Those arrive in later phases below.

## MVP user flow

**Admin:** creates a workspace (for example, "Customer Management"),
drags in a table, a form, notes, comments, and calculations, configures
fields, permissions, and layout, and saves it.

**User:** opens the workspace and sees a customer grid, a notes panel,
and a summary footer — with no coding involved on either side.

## Development roadmap

### Phase 0 — Research and Architecture (roughly 1 month)

Goal: define the foundation.

Activities: study existing grid engines (Grist internals, Glide Data
Grid, AG Grid architecture), define the workspace schema, define the
rendering architecture, prototype Rust/WASM communication, and design
the plugin architecture.

Deliverables: an architecture document, a workspace specification, and a
prototype renderer.

### Phase 1 — Core Workspace Runtime (roughly 3 months)

Goal: build the minimum working platform.

Features: JSON/YAML workspace definitions, grid rendering, basic
editing, layout regions, data binding, and basic permissions.

Success criteria: a developer can create a functional application
without manually building UI screens.

### Phase 2 — Advanced User Experience (roughly 3 months)

Features: forms, sidebar panels, footer calculations, custom views,
saved layouts, personal preferences, validation rules, and conditional
formatting.

Success criteria: users can customize their own workspace experience.

### Phase 3 — Enterprise Capabilities

Features: role-based permissions, audit history, version control,
collaboration, extensions, workflow actions, and external integrations.

Success criteria: the platform can support complex organizational
requirements.

Within this phase, build one small ERP example — not a full ERP — in a
single domain such as inventory, employee management, or invoice
approval, and use it as proof, feeding real workspace definitions from
that domain back into the engine.

### Phase 4 — Intelligence Layer

Features: AI assistants, natural language commands, automatic workspace
generation, data analysis, recommendations, and intelligent automation.

Success criteria: users interact with the software through goals rather
than through predefined screens.

## Long-term vision

Create a universal workspace runtime where applications are no longer
limited by predefined screens: data defines possibilities, users define
workflows, organizations define governance, and AI helps create and
improve experiences. The platform becomes a foundation for building
adaptable, intelligent, user-focused software systems.

## Key differentiation

Traditional applications flow from requirement, to developer, to UI
development, to deployment, to user adoption — a long chain with a
developer in the middle of every change.

Workspace-based applications flow from business need, directly to a
workspace definition, to runtime generation, to an immediate user
experience — collapsing that chain.

The objective is not to eliminate software development. The objective is
to remove unnecessary barriers between business needs and usable
software.

## Naming

The project is named **Gridyard**, kept as a separate identity from the
eventual ERP from day one. The ERP is one possible application built on
top of it; Gridyard itself is the reusable core. See
`07-repo-scaffolding-spec.md` for the repository setup.
