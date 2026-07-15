//! Copy / cut / paste with relative formula adjustment.
//!
//! See `docs/01-grid-engine-core-spec.md` (Clipboard). Paste is recorded as a
//! single [`BatchEditCommand`] so undo/redo treats the whole paste as one step.

use gridyard_core::{cell_id, unpack_cell_id};
use gridyard_formula::shift_formula_refs;

use crate::undo::{BatchEditCommand, CellEditCommand};

/// Inclusive rectangular range of cells (0-based coordinates).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct CellRange {
    /// Top-left row (inclusive).
    pub start_row: u32,
    /// Top-left column (inclusive).
    pub start_col: u32,
    /// Bottom-right row (inclusive).
    pub end_row: u32,
    /// Bottom-right column (inclusive).
    pub end_col: u32,
}

impl CellRange {
    /// Builds a range and normalizes so `start_* <= end_*`.
    pub fn new(start_row: u32, start_col: u32, end_row: u32, end_col: u32) -> Self {
        Self {
            start_row: start_row.min(end_row),
            start_col: start_col.min(end_col),
            end_row: start_row.max(end_row),
            end_col: start_col.max(end_col),
        }
    }

    /// Single-cell range.
    pub fn cell(row: u32, col: u32) -> Self {
        Self::new(row, col, row, col)
    }

    /// Number of rows in the range (at least 1).
    pub fn row_count(&self) -> u32 {
        self.end_row - self.start_row + 1
    }

    /// Number of columns in the range (at least 1).
    pub fn col_count(&self) -> u32 {
        self.end_col - self.start_col + 1
    }

    /// Returns `true` when `(row, col)` lies inside this range.
    pub fn contains(&self, row: u32, col: u32) -> bool {
        row >= self.start_row && row <= self.end_row && col >= self.start_col && col <= self.end_col
    }
}

/// Read/write surface used by clipboard operations (raw user inputs).
pub trait ClipboardSheet {
    /// Raw input at `(row, col)` — literal or `=formula`, or `""` if empty.
    fn get_input(&self, row: u32, col: u32) -> String;
    /// Writes raw input at `(row, col)`.
    fn set_input(&mut self, row: u32, col: u32, input: &str);
}

/// In-memory clipboard payload produced by [`copy`] / [`cut`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Clipboard {
    /// Top-left row of the source range.
    pub origin_row: u32,
    /// Top-left column of the source range.
    pub origin_col: u32,
    /// Number of rows in the payload.
    pub rows: u32,
    /// Number of columns in the payload.
    pub cols: u32,
    /// When `true`, the next successful paste clears the source (cut semantics).
    pub is_cut: bool,
    /// Cells relative to the origin: `(row_offset, col_offset, raw_input)`.
    cells: Vec<(u32, u32, String)>,
}

impl Clipboard {
    /// Source range this clipboard was copied/cut from.
    pub fn source_range(&self) -> CellRange {
        CellRange::new(
            self.origin_row,
            self.origin_col,
            self.origin_row + self.rows - 1,
            self.origin_col + self.cols - 1,
        )
    }
}

/// Copies `range` into a clipboard (formulas kept as raw input; no sheet mutation).
pub fn copy(sheet: &impl ClipboardSheet, range: CellRange) -> Clipboard {
    snapshot(sheet, range, false)
}

/// Cuts `range` into a clipboard. The sheet is not cleared until [`paste`].
pub fn cut(sheet: &impl ClipboardSheet, range: CellRange) -> Clipboard {
    snapshot(sheet, range, true)
}

fn snapshot(sheet: &impl ClipboardSheet, range: CellRange, is_cut: bool) -> Clipboard {
    let mut cells = Vec::new();
    for row in range.start_row..=range.end_row {
        for col in range.start_col..=range.end_col {
            cells.push((
                row - range.start_row,
                col - range.start_col,
                sheet.get_input(row, col),
            ));
        }
    }
    Clipboard {
        origin_row: range.start_row,
        origin_col: range.start_col,
        rows: range.row_count(),
        cols: range.col_count(),
        is_cut,
        cells,
    }
}

/// Pastes `clipboard` with its top-left at `(target_row, target_col)`.
///
/// Relative formula references are adjusted by the paste delta. Returns a
/// single [`BatchEditCommand`] covering destination writes and (for cut)
/// source clears. After a cut-paste, `clipboard.is_cut` is cleared on a clone
/// return path — callers should drop cut mode themselves via
/// [`Clipboard::clear_cut`].
pub fn paste(
    sheet: &mut impl ClipboardSheet,
    clipboard: &Clipboard,
    target_row: u32,
    target_col: u32,
) -> BatchEditCommand {
    let mut edits: Vec<CellEditCommand> = Vec::new();

    for &(or, oc, ref input) in &clipboard.cells {
        let dest_row = target_row + or;
        let dest_col = target_col + oc;
        let src_row = clipboard.origin_row + or;
        let src_col = clipboard.origin_col + oc;
        let d_row = dest_row as i32 - src_row as i32;
        let d_col = dest_col as i32 - src_col as i32;
        let new_input = shift_formula_refs(input, d_row, d_col);
        push_set(sheet, &mut edits, dest_row, dest_col, &new_input);
    }

    if clipboard.is_cut {
        let dest = CellRange::new(
            target_row,
            target_col,
            target_row + clipboard.rows - 1,
            target_col + clipboard.cols - 1,
        );
        let source = clipboard.source_range();
        for row in source.start_row..=source.end_row {
            for col in source.start_col..=source.end_col {
                if dest.contains(row, col) {
                    continue;
                }
                push_set(sheet, &mut edits, row, col, "");
            }
        }
    }

    BatchEditCommand { edits }
}

impl Clipboard {
    /// Clears the cut flag so subsequent pastes behave like copy.
    pub fn clear_cut(&mut self) {
        self.is_cut = false;
    }
}

fn push_set(
    sheet: &mut impl ClipboardSheet,
    edits: &mut Vec<CellEditCommand>,
    row: u32,
    col: u32,
    new_input: &str,
) {
    let old_input = sheet.get_input(row, col);
    if old_input == new_input {
        return;
    }
    sheet.set_input(row, col, new_input);
    edits.push(CellEditCommand {
        cell: cell_id(row, col),
        old_input,
        new_input: new_input.to_string(),
    });
}

/// Applies the inverse of a batch (undo).
pub fn apply_batch_undo(sheet: &mut impl ClipboardSheet, batch: &BatchEditCommand) {
    for edit in batch.edits.iter().rev() {
        let (row, col) = unpack_cell_id(edit.cell);
        sheet.set_input(row, col, &edit.old_input);
    }
}

/// Re-applies a batch (redo).
pub fn apply_batch_redo(sheet: &mut impl ClipboardSheet, batch: &BatchEditCommand) {
    for edit in &batch.edits {
        let (row, col) = unpack_cell_id(edit.cell);
        sheet.set_input(row, col, &edit.new_input);
    }
}

/// Convenience: paste and record on an undo stack as one command.
pub fn paste_with_undo(
    sheet: &mut impl ClipboardSheet,
    clipboard: &mut Clipboard,
    target_row: u32,
    target_col: u32,
    undo: &mut crate::undo::UndoStack<BatchEditCommand>,
) -> BatchEditCommand {
    let batch = paste(sheet, clipboard, target_row, target_col);
    if clipboard.is_cut {
        clipboard.clear_cut();
    }
    undo.push_batch(batch.clone());
    batch
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::undo::UndoStack;
    use gridyard_core::CellId;
    use std::collections::HashMap;

    #[derive(Default)]
    struct MapSheet {
        cells: HashMap<CellId, String>,
    }

    impl ClipboardSheet for MapSheet {
        fn get_input(&self, row: u32, col: u32) -> String {
            self.cells
                .get(&cell_id(row, col))
                .cloned()
                .unwrap_or_default()
        }

        fn set_input(&mut self, row: u32, col: u32, input: &str) {
            let id = cell_id(row, col);
            if input.is_empty() {
                self.cells.remove(&id);
            } else {
                self.cells.insert(id, input.to_string());
            }
        }
    }

    #[test]
    fn single_cell_copy_paste_literal() {
        let mut sheet = MapSheet::default();
        sheet.set_input(0, 0, "hello");
        let clip = copy(&sheet, CellRange::cell(0, 0));
        let batch = paste(&mut sheet, &clip, 2, 3);
        assert_eq!(sheet.get_input(2, 3), "hello");
        assert_eq!(batch.edits.len(), 1);
        assert_eq!(sheet.get_input(0, 0), "hello");
    }

    #[test]
    fn formula_refs_adjust_on_paste() {
        let mut sheet = MapSheet::default();
        // B1 (=A1): copy to C3 → =B3
        sheet.set_input(0, 1, "=A1");
        let clip = copy(&sheet, CellRange::cell(0, 1));
        paste(&mut sheet, &clip, 2, 2);
        assert_eq!(sheet.get_input(2, 2), "=B3");
    }

    #[test]
    fn range_copy_paste() {
        let mut sheet = MapSheet::default();
        sheet.set_input(0, 0, "a");
        sheet.set_input(0, 1, "b");
        sheet.set_input(1, 0, "=A1");
        sheet.set_input(1, 1, "2");
        let clip = copy(&sheet, CellRange::new(0, 0, 1, 1));
        paste(&mut sheet, &clip, 5, 2);
        assert_eq!(sheet.get_input(5, 2), "a");
        assert_eq!(sheet.get_input(5, 3), "b");
        // =A1 from (1,0) → paste at (6,2): delta (+5, +2) → =C6
        assert_eq!(sheet.get_input(6, 2), "=C6");
        assert_eq!(sheet.get_input(6, 3), "2");
    }

    #[test]
    fn cut_paste_clears_source_and_undos_as_one_step() {
        let mut sheet = MapSheet::default();
        sheet.set_input(0, 0, "x");
        sheet.set_input(0, 1, "y");
        let mut clip = cut(&sheet, CellRange::new(0, 0, 0, 1));
        let mut undo = UndoStack::new();
        paste_with_undo(&mut sheet, &mut clip, 2, 0, &mut undo);
        assert_eq!(sheet.get_input(2, 0), "x");
        assert_eq!(sheet.get_input(2, 1), "y");
        assert_eq!(sheet.get_input(0, 0), "");
        assert_eq!(sheet.get_input(0, 1), "");
        assert!(!clip.is_cut);
        assert_eq!(undo.undo_len(), 1);

        let batch = undo.undo().expect("undo paste");
        apply_batch_undo(&mut sheet, &batch);
        assert_eq!(sheet.get_input(0, 0), "x");
        assert_eq!(sheet.get_input(0, 1), "y");
        assert_eq!(sheet.get_input(2, 0), "");
        assert_eq!(sheet.get_input(2, 1), "");

        let batch = undo.redo().expect("redo paste");
        apply_batch_redo(&mut sheet, &batch);
        assert_eq!(sheet.get_input(2, 0), "x");
        assert_eq!(sheet.get_input(0, 0), "");
    }

    #[test]
    fn paste_overwrites_existing_and_is_undoable() {
        let mut sheet = MapSheet::default();
        sheet.set_input(0, 0, "src");
        sheet.set_input(5, 5, "old");
        let clip = copy(&sheet, CellRange::cell(0, 0));
        let mut undo = UndoStack::new();
        let mut clip = clip;
        paste_with_undo(&mut sheet, &mut clip, 5, 5, &mut undo);
        assert_eq!(sheet.get_input(5, 5), "src");
        let batch = undo.undo().unwrap();
        apply_batch_undo(&mut sheet, &batch);
        assert_eq!(sheet.get_input(5, 5), "old");
    }

    #[test]
    fn table_driven_clipboard_cases() {
        struct Case {
            seed: &'static [((u32, u32), &'static str)],
            range: (u32, u32, u32, u32),
            cut: bool,
            target: (u32, u32),
            expect: &'static [((u32, u32), &'static str)],
        }

        let cases = [
            Case {
                seed: &[((0, 0), "1"), ((0, 1), "=A1")],
                range: (0, 1, 0, 1),
                cut: false,
                target: (1, 1),
                // =A1 from B1 → paste at B2: delta (+1,0) → =A2
                expect: &[((1, 1), "=A2")],
            },
            Case {
                seed: &[((2, 2), "z")],
                range: (2, 2, 2, 2),
                cut: true,
                target: (0, 0),
                expect: &[((0, 0), "z"), ((2, 2), "")],
            },
        ];

        for (i, case) in cases.iter().enumerate() {
            let mut sheet = MapSheet::default();
            for &((r, c), v) in case.seed {
                sheet.set_input(r, c, v);
            }
            let range = CellRange::new(case.range.0, case.range.1, case.range.2, case.range.3);
            let clip = if case.cut {
                cut(&sheet, range)
            } else {
                copy(&sheet, range)
            };
            paste(&mut sheet, &clip, case.target.0, case.target.1);
            for &((r, c), v) in case.expect {
                assert_eq!(sheet.get_input(r, c), v, "case {i} at ({r},{c})");
            }
        }
    }
}
