//! Sparse cell storage keyed by [`CellId`].
//!
//! Only non-empty cells occupy memory — see
//! `docs/01-grid-engine-core-spec.md` (Internal data model).

use std::collections::HashMap;

use crate::cell::Cell;
use crate::CellId;

/// Flat sparse map of cells. Missing keys are treated as empty cells.
#[derive(Debug, Clone, Default)]
pub struct SparseGrid {
    cells: HashMap<CellId, Cell>,
}

impl SparseGrid {
    /// Creates an empty grid with no stored cells.
    pub fn new() -> Self {
        Self {
            cells: HashMap::new(),
        }
    }

    /// Returns a reference to the stored cell, or `None` if the cell is
    /// absent (conceptually empty).
    pub fn get_cell(&self, id: CellId) -> Option<&Cell> {
        self.cells.get(&id)
    }

    /// Inserts or replaces a cell.
    ///
    /// If `cell` is empty ([`Cell::is_empty`]), any existing entry for
    /// `id` is removed instead of storing a blank cell.
    pub fn set_cell(&mut self, id: CellId, cell: Cell) {
        if cell.is_empty() {
            self.cells.remove(&id);
        } else {
            self.cells.insert(id, cell);
        }
    }

    /// Removes a cell entry, returning it if it was present.
    pub fn remove_cell(&mut self, id: CellId) -> Option<Cell> {
        self.cells.remove(&id)
    }

    /// Number of stored (non-empty) cells.
    pub fn len(&self) -> usize {
        self.cells.len()
    }

    /// Returns `true` when no cells are stored.
    pub fn is_empty(&self) -> bool {
        self.cells.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cell::Cell;
    use crate::value::{ErrorKind, Value};
    use crate::{cell_id, unpack_cell_id};

    #[test]
    fn get_set_remove_round_trip() {
        let mut grid = SparseGrid::new();
        let id = cell_id(2, 5);
        let cell = Cell::new("hi", Value::Text("hi".into()));

        assert!(grid.get_cell(id).is_none());
        grid.set_cell(id, cell.clone());
        assert_eq!(grid.get_cell(id), Some(&cell));
        assert_eq!(grid.len(), 1);

        let removed = grid.remove_cell(id);
        assert_eq!(removed, Some(cell));
        assert!(grid.get_cell(id).is_none());
        assert!(grid.is_empty());
    }

    #[test]
    fn empty_cells_are_never_stored() {
        let mut grid = SparseGrid::new();
        let id = cell_id(0, 0);

        grid.set_cell(id, Cell::default());
        assert!(grid.get_cell(id).is_none());
        assert_eq!(grid.len(), 0);

        grid.set_cell(id, Cell::new("x", Value::Text("x".into())));
        assert!(grid.get_cell(id).is_some());

        // Clearing to empty frees the entry.
        grid.set_cell(id, Cell::new("", Value::Empty));
        assert!(grid.get_cell(id).is_none());
        assert_eq!(grid.len(), 0);
    }

    #[test]
    fn set_overwrites_existing_cell() {
        let mut grid = SparseGrid::new();
        let id = cell_id(1, 1);

        grid.set_cell(id, Cell::new("1", Value::Number(1.0)));
        grid.set_cell(id, Cell::new("2", Value::Number(2.0)));

        assert_eq!(
            grid.get_cell(id).map(|c| &c.value),
            Some(&Value::Number(2.0))
        );
        assert_eq!(grid.len(), 1);
    }

    #[test]
    fn remove_missing_returns_none() {
        let mut grid = SparseGrid::new();
        assert_eq!(grid.remove_cell(cell_id(9, 9)), None);
    }

    #[test]
    fn stores_only_addressed_cells_sparsely() {
        let mut grid = SparseGrid::new();
        let cases: &[(u32, u32, Cell)] = &[
            (0, 0, Cell::new("a", Value::Text("a".into()))),
            (100, 50, Cell::new("1", Value::Number(1.0))),
            (1_000_000, 3, Cell::new("true", Value::Bool(true))),
            (2, 2, Cell::new("#REF!", Value::Error(ErrorKind::Ref))),
        ];

        for &(row, col, ref cell) in cases {
            grid.set_cell(cell_id(row, col), cell.clone());
        }

        assert_eq!(grid.len(), cases.len());
        for &(row, col, ref cell) in cases {
            let id = cell_id(row, col);
            assert_eq!(unpack_cell_id(id), (row, col));
            assert_eq!(grid.get_cell(id), Some(cell));
        }
        // Unset coordinates stay absent.
        assert!(grid.get_cell(cell_id(0, 1)).is_none());
    }
}
