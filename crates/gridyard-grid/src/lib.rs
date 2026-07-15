//! Selection, clipboard, sort/filter, and the undo/redo command stack
//! for Gridyard. See `docs/01-grid-engine-core-spec.md`.

mod clipboard;
mod undo;

pub use clipboard::{
    apply_batch_redo, apply_batch_undo, copy, cut, paste, paste_with_undo, CellRange, Clipboard,
    ClipboardSheet,
};
pub use undo::{BatchEditCommand, CellEditCommand, UndoStack, DEFAULT_UNDO_LIMIT};
