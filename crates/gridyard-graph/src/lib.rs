//! Dependency graph, dirty-marking, and topological recalculation for
//! Gridyard. See `docs/01-grid-engine-core-spec.md`.

mod dep_graph;
mod engine;

pub use dep_graph::DepGraph;
pub use engine::{a1, SheetEngine};
