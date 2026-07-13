//! Native grid handle shared by WASM exports and unit tests.
//!
//! Kept free of `wasm-bindgen` so `cargo test` exercises the same wiring
//! the JS API uses.

use gridyard_core::{cell_id, Value};
use gridyard_graph::SheetEngine;

/// Thin facade over [`SheetEngine`] using `(row, col)` coordinates.
#[derive(Debug, Default)]
pub struct GridHandle {
    engine: SheetEngine,
}

impl GridHandle {
    /// Creates an empty grid.
    pub fn new() -> Self {
        Self {
            engine: SheetEngine::new(),
        }
    }

    /// Sets the cell at `(row, col)` from user input and recalculates.
    pub fn set_cell(&mut self, row: u32, col: u32, input: &str) -> Result<(), String> {
        self.engine
            .set_cell(cell_id(row, col), input)
            .map_err(|e| e.to_string())
    }

    /// Returns the computed value at `(row, col)`.
    pub fn get_cell(&self, row: u32, col: u32) -> Value {
        self.engine.get_value(cell_id(row, col))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use gridyard_core::ErrorKind;

    #[test]
    fn create_set_formula_and_read_computed() {
        let mut grid = GridHandle::new();
        grid.set_cell(0, 0, "10").expect("A1");
        grid.set_cell(0, 1, "=A1*2").expect("B1");
        assert_eq!(grid.get_cell(0, 1), Value::Number(20.0));
    }

    #[test]
    fn updating_precedent_updates_dependent_on_next_get() {
        let mut grid = GridHandle::new();
        grid.set_cell(0, 0, "1").expect("A1");
        grid.set_cell(0, 1, "=A1+1").expect("B1");
        assert_eq!(grid.get_cell(0, 1), Value::Number(2.0));

        grid.set_cell(0, 0, "5").expect("A1 update");
        assert_eq!(grid.get_cell(0, 1), Value::Number(6.0));
    }

    #[test]
    fn malformed_formula_returns_error() {
        let mut grid = GridHandle::new();
        let err = grid.set_cell(0, 0, "=1+").expect_err("parse error");
        assert!(!err.is_empty());
        assert_eq!(grid.get_cell(0, 0), Value::Empty);
    }

    #[test]
    fn circular_reference_surfaces_as_error_value() {
        let mut grid = GridHandle::new();
        grid.set_cell(0, 0, "=B1").expect("A1");
        grid.set_cell(0, 1, "=A1").expect("B1");
        assert_eq!(grid.get_cell(0, 0), Value::Error(ErrorKind::Circular));
        assert_eq!(grid.get_cell(0, 1), Value::Error(ErrorKind::Circular));
    }
}
