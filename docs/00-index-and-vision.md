# Gridyard — Business Workspace Engine Spec Index

## Purpose

This is the entry point for the Cursor-assisted build of **Gridyard**,
the business workspace engine. It links to the individual deliverable
specs below. Feed one spec file at a time to Cursor per build session,
in the order listed.

## Vision

The goal is a next-generation workspace engine that lets organizations
build flexible, powerful, user-friendly business applications without
continuous custom UI development. It combines the flexibility of
spreadsheet applications with the structure, security, scalability, and
governance expected from modern software systems.

Traditional enterprise software fails when it becomes a barrier between
the user's intention and the business outcome. The traditional flow:

```
Business process
   |
Developer interprets requirement
   |
Database model
   |
UI screens
   |
Training users
   |
Users adapt to software
```

The assumption in that model is that the business will change its
behavior to fit the software. The workspace engine inverts this:

```
User goal
   |
System understands context
   |
User completes the task
```

The system adapts to the user, not the other way around. The missing
piece in most ERP and enterprise systems is an **Intent Layer** —
something between business users and the application that lets a screen
or workflow change without a developer writing new database migrations,
APIs, and frontend pages.

Example — a finance officer needs a new screen:

```
Workspace: Loan Review

Main:
    Loan table

Right:
    Customer history
    Notes
    Documents

Footer:
    Total overdue amount
    Average delay

Actions:
    Send reminder
```

Changing the workspace definition produces the screen — no deploy
required.

## Two project identities

**Project 1 — Gridyard** (the infrastructure)
Target audience: developers, SaaS builders, ERP vendors, internal tools
teams.
Position: "Build adaptable enterprise applications without rebuilding the
UI every time."

**Project 2 — Agentic ERP** (the showcase, built later on top of the
engine)
Target audience: SMB, manufacturing, finance, services.
Position: "An ERP that adapts to your business instead of forcing your
business to adapt."

The workspace engine is the multiplier — one runtime, many applications:

```
Gridyard
        |
        +---- ERP
        |
        +---- CRM
        |
        +---- Government Portal
        |
        +---- Manufacturing System
        |
        +---- Finance Application
```

## Solving ERP customization without forking

Traditional ERP customization forks the codebase:

```
Core ERP
   |
Customization
   |
Fork
   |
Upgrade nightmare
```

The workspace model instead layers extensions without forking:

```
Core Workspace Definition
        +
Company Extension
        +
Department Extension
        +
Personal Preference
```

Similar to inheritance:

```
Core
 |
 +-- Company
       |
       +-- Department
             |
             +-- User
```

## High-level system architecture

```
                  Browser
                     |
        React / SolidJS / Svelte
                     |
          Virtualized Spreadsheet UI
                     |
         +-----------+-----------+
         |                       |
         |       Rust WASM       |
         |                       |
         |  Cell Storage         |
         |  Formula Engine       |
         |  Dependency Graph     |
         |  Undo/Redo            |
         |  Clipboard            |
         |  Selection            |
         |  Formatting           |
         |  Filtering            |
         |  Sorting              |
         |  Validation           |
         +-----------+-----------+
                     |
             IndexedDB / OPFS
```

Rust owns everything expensive or correctness-critical: recalculation,
dependency graph, large datasets, formula parsing, sorting, filtering,
undo, diffing, serialization. The UI stays in JavaScript/TypeScript
(React, SolidJS, or Svelte) — Rust never touches the DOM.

## Tech stack

Frontend: React or SolidJS, TypeScript, Canvas rendering (WebGL later),
Vite.

Engine: Rust, wasm-bindgen, web-sys, serde, slotmap or
generational-arena, petgraph (dependency graph), rayon for native builds
with worker-based parallelism for WASM.

Storage: IndexedDB, OPFS (Origin Private File System) for large
workbooks, binary serialization via bincode or postcard.

Optional native desktop: the same Rust engine compiled natively, UI via
Tauri.

## Spec files

1. `01-grid-engine-core-spec.md` — Rust core: cell storage, formula
   engine, dependency graph, undo, clipboard, sorting/filtering, storage
   format, performance tricks.
2. `02-rendering-layer-spec.md` — Virtualized canvas rendering,
   huge-dataset handling, search.
3. `03-workspace-schema-spec.md` — Declarative workspace definition
   format and examples.
4. `04-layout-and-permission-engine-spec.md` — Layout engine (main +
   bottom grids), permission engine, data binding engine. Form engine
   explicitly out of current scope.
5. `05-extensions-plugins-ai-spec.md` — Plugin system, custom cell
   types, workflow extensions, collaboration, AI/agent capabilities.
6. `06-mvp-scope-and-roadmap.md` — MVP folder structure, phased roadmap,
   key differentiation.
7. `07-repo-scaffolding-spec.md` — Git repository setup: structure,
   license, README, CI, and initial commit sequence for Gridyard.
