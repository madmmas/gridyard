//! Selection, clipboard, sort/filter, and the undo/redo command stack
//! for Gridyard. See `docs/01-grid-engine-core-spec.md`.

mod undo;

pub use undo::{CellEditCommand, UndoStack, DEFAULT_UNDO_LIMIT};
