//! Dependency graph, dirty-marking, and topological recalculation for
//! Gridyard. See `docs/01-grid-engine-core-spec.md` and
//! `docs/04-layout-and-permission-engine-spec.md` (cross-region reads).

mod dep_graph;
mod engine;
mod workspace;

pub use dep_graph::DepGraph;
pub use engine::{a1, SheetEngine};
pub use workspace::{Region, WorkspaceEngine};
