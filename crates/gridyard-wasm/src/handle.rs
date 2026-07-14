//! Native grid handle shared by WASM exports and unit tests.
//!
//! Kept free of `wasm-bindgen` so `cargo test` exercises the same wiring
//! the JS API uses.

use gridyard_core::{cell_id, CellId, Value};
use gridyard_graph::{Region, SheetEngine, WorkspaceEngine};
use gridyard_grid::{CellEditCommand, UndoStack};

/// Thin facade over [`SheetEngine`] using `(row, col)` coordinates,
/// with a bounded single-cell undo/redo stack.
#[derive(Debug, Default)]
pub struct GridHandle {
    engine: SheetEngine,
    history: UndoStack<CellEditCommand>,
}

impl GridHandle {
    /// Creates an empty grid with default undo depth
    /// ([`gridyard_grid::DEFAULT_UNDO_LIMIT`]).
    pub fn new() -> Self {
        Self {
            engine: SheetEngine::new(),
            history: UndoStack::new(),
        }
    }

    /// Creates a grid whose undo stack keeps at most `limit` entries.
    pub fn with_undo_limit(limit: usize) -> Self {
        Self {
            engine: SheetEngine::new(),
            history: UndoStack::with_limit(limit),
        }
    }

    /// Sets the cell at `(row, col)` from user input, recalculates, and
    /// records an undo step when the stored input actually changes.
    pub fn set_cell(&mut self, row: u32, col: u32, input: &str) -> Result<(), String> {
        let id = cell_id(row, col);
        let old_input = self.engine.get_input(id);
        self.apply_input(id, input)?;
        let new_input = self.engine.get_input(id);
        self.history.push_edit(CellEditCommand {
            cell: id,
            old_input,
            new_input,
        });
        Ok(())
    }

    /// Returns the computed value at `(row, col)`.
    pub fn get_cell(&self, row: u32, col: u32) -> Value {
        self.engine.get_value(cell_id(row, col))
    }

    /// Returns the raw user input at `(row, col)` (literal or `=formula`).
    pub fn get_input(&self, row: u32, col: u32) -> String {
        self.engine.get_input(cell_id(row, col))
    }

    /// Reverts the most recent recorded edit and recalculates dependents.
    ///
    /// Returns `true` when a command was applied.
    pub fn undo(&mut self) -> bool {
        let Some(command) = self.history.undo() else {
            return false;
        };
        let _ = self.apply_input(command.cell, &command.old_input);
        true
    }

    /// Re-applies the most recently undone edit and recalculates dependents.
    ///
    /// Returns `true` when a command was applied.
    pub fn redo(&mut self) -> bool {
        let Some(command) = self.history.redo() else {
            return false;
        };
        let _ = self.apply_input(command.cell, &command.new_input);
        true
    }

    /// Returns `true` when [`Self::undo`] would change the sheet.
    pub fn can_undo(&self) -> bool {
        self.history.can_undo()
    }

    /// Returns `true` when [`Self::redo`] would change the sheet.
    pub fn can_redo(&self) -> bool {
        self.history.can_redo()
    }

    /// Drops undo/redo history without changing cell values.
    ///
    /// Useful after seeding fixture data so the user cannot undo into
    /// the initial load.
    pub fn clear_history(&mut self) {
        self.history.clear();
    }

    fn apply_input(&mut self, id: CellId, input: &str) -> Result<(), String> {
        self.engine.set_cell(id, input).map_err(|e| e.to_string())
    }
}

/// One workspace edit: region + cell + old/new input for undo/redo.
#[derive(Debug, Clone, PartialEq, Eq)]
struct WorkspaceEditCommand {
    region: Region,
    cell: CellId,
    old_input: String,
    new_input: String,
}

/// Thin facade over [`WorkspaceEngine`] with region-addressed `(row, col)`.
///
/// Region names are `"main"` and `"bottom"` (case-insensitive). Cross-region
/// formulas like `=main!A1` are evaluated by the underlying workspace engine.
/// A single shared undo stack spans both regions (most recent edit first).
#[derive(Debug, Default)]
pub struct WorkspaceHandle {
    engine: WorkspaceEngine,
    history: UndoStack<WorkspaceEditCommand>,
}

impl WorkspaceHandle {
    /// Creates an empty two-region workspace (`main` + `bottom`).
    pub fn new() -> Self {
        Self {
            engine: WorkspaceEngine::new(),
            history: UndoStack::new(),
        }
    }

    /// Creates a workspace whose undo stack keeps at most `limit` entries.
    pub fn with_undo_limit(limit: usize) -> Self {
        Self {
            engine: WorkspaceEngine::new(),
            history: UndoStack::with_limit(limit),
        }
    }

    /// Sets a cell in `region` from a literal or `=formula`.
    pub fn set_cell(
        &mut self,
        region: &str,
        row: u32,
        col: u32,
        input: &str,
    ) -> Result<(), String> {
        let region = parse_region(region)?;
        let id = cell_id(row, col);
        let old_input = self.engine.get_input(region, id);
        self.apply_input(region, id, input)?;
        let new_input = self.engine.get_input(region, id);
        if old_input != new_input {
            self.history.push(WorkspaceEditCommand {
                region,
                cell: id,
                old_input,
                new_input,
            });
        }
        Ok(())
    }

    /// Returns the computed value at `(region, row, col)`.
    pub fn get_cell(&self, region: &str, row: u32, col: u32) -> Result<Value, String> {
        let region = parse_region(region)?;
        Ok(self.engine.get_value(region, cell_id(row, col)))
    }

    /// Returns the raw user input at `(region, row, col)`.
    pub fn get_input(&self, region: &str, row: u32, col: u32) -> Result<String, String> {
        let region = parse_region(region)?;
        Ok(self.engine.get_input(region, cell_id(row, col)))
    }

    /// Reverts the most recent recorded edit (any region) and recalculates.
    ///
    /// Returns `true` when a command was applied.
    pub fn undo(&mut self) -> bool {
        let Some(command) = self.history.undo() else {
            return false;
        };
        let _ = self.apply_input(command.region, command.cell, &command.old_input);
        true
    }

    /// Re-applies the most recently undone edit. Returns `true` when applied.
    pub fn redo(&mut self) -> bool {
        let Some(command) = self.history.redo() else {
            return false;
        };
        let _ = self.apply_input(command.region, command.cell, &command.new_input);
        true
    }

    /// Returns `true` when [`Self::undo`] would change the workspace.
    pub fn can_undo(&self) -> bool {
        self.history.can_undo()
    }

    /// Returns `true` when [`Self::redo`] would change the workspace.
    pub fn can_redo(&self) -> bool {
        self.history.can_redo()
    }

    /// Drops undo/redo history without changing cell values.
    pub fn clear_history(&mut self) {
        self.history.clear();
    }

    fn apply_input(&mut self, region: Region, id: CellId, input: &str) -> Result<(), String> {
        self.engine
            .set_cell(region, id, input)
            .map_err(|e| e.to_string())
    }
}

fn parse_region(name: &str) -> Result<Region, String> {
    Region::from_name(name).ok_or_else(|| format!("unknown region `{name}`"))
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
    fn malformed_formula_surfaces_as_error_value() {
        let mut grid = GridHandle::new();
        grid.set_cell(0, 0, "=1+").expect("stored with error");
        assert_eq!(grid.get_input(0, 0), "=1+");
        assert_eq!(grid.get_cell(0, 0), Value::Error(ErrorKind::Value));
    }

    #[test]
    fn get_input_round_trips_literals_and_formulas() {
        let mut grid = GridHandle::new();
        grid.set_cell(0, 0, "10").expect("A1");
        grid.set_cell(0, 1, "=A1*2").expect("B1");
        assert_eq!(grid.get_input(0, 0), "10");
        assert_eq!(grid.get_input(0, 1), "=A1*2");
        assert_eq!(grid.get_input(1, 0), "");
    }

    #[test]
    fn circular_reference_surfaces_as_error_value() {
        let mut grid = GridHandle::new();
        grid.set_cell(0, 0, "=B1").expect("A1");
        grid.set_cell(0, 1, "=A1").expect("B1");
        assert_eq!(grid.get_cell(0, 0), Value::Error(ErrorKind::Circular));
        assert_eq!(grid.get_cell(0, 1), Value::Error(ErrorKind::Circular));
    }

    #[test]
    fn undo_reverts_edit_and_recalculates_dependents() {
        let mut grid = GridHandle::new();
        grid.set_cell(0, 0, "1").expect("A1");
        grid.set_cell(0, 1, "=A1+1").expect("B1");
        grid.set_cell(0, 0, "10").expect("A1 edit");
        assert_eq!(grid.get_cell(0, 1), Value::Number(11.0));

        assert!(grid.undo());
        assert_eq!(grid.get_input(0, 0), "1");
        assert_eq!(grid.get_cell(0, 1), Value::Number(2.0));
    }

    #[test]
    fn redo_reapplies_undone_edit() {
        let mut grid = GridHandle::new();
        grid.set_cell(0, 0, "1").expect("A1");
        grid.set_cell(0, 0, "5").expect("A1 edit");
        assert!(grid.undo());
        assert_eq!(grid.get_input(0, 0), "1");
        assert!(grid.redo());
        assert_eq!(grid.get_input(0, 0), "5");
    }

    #[test]
    fn new_edit_after_undo_clears_redo() {
        let mut grid = GridHandle::new();
        grid.set_cell(0, 0, "1").expect("A1");
        grid.set_cell(0, 0, "2").expect("A1→2");
        assert!(grid.undo());
        assert!(grid.can_redo());
        grid.set_cell(0, 0, "9").expect("A1→9");
        assert!(!grid.can_redo());
        assert!(grid.undo());
        assert_eq!(grid.get_input(0, 0), "1");
    }

    #[test]
    fn history_is_bounded() {
        let mut grid = GridHandle::with_undo_limit(2);
        grid.set_cell(0, 0, "1").expect("1");
        grid.set_cell(0, 0, "2").expect("2");
        grid.set_cell(0, 0, "3").expect("3");
        assert!(grid.undo());
        assert_eq!(grid.get_input(0, 0), "2");
        assert!(grid.undo());
        assert_eq!(grid.get_input(0, 0), "1");
        assert!(!grid.undo());
    }

    #[test]
    fn clear_history_keeps_values() {
        let mut grid = GridHandle::new();
        grid.set_cell(0, 0, "1").expect("A1");
        grid.clear_history();
        assert!(!grid.can_undo());
        assert_eq!(grid.get_input(0, 0), "1");
    }

    #[test]
    fn workspace_cross_region_set_get_and_propagate() {
        let mut ws = WorkspaceHandle::new();
        ws.set_cell("main", 0, 0, "10").expect("main A1");
        ws.set_cell("bottom", 0, 0, "=main!A1*2")
            .expect("bottom A1");
        assert_eq!(ws.get_cell("bottom", 0, 0).unwrap(), Value::Number(20.0));

        ws.set_cell("main", 0, 0, "7").expect("main A1 update");
        assert_eq!(ws.get_cell("bottom", 0, 0).unwrap(), Value::Number(14.0));
        assert_eq!(ws.get_input("bottom", 0, 0).unwrap(), "=main!A1*2");
    }

    #[test]
    fn workspace_sum_over_main_range() {
        let mut ws = WorkspaceHandle::new();
        ws.set_cell("main", 1, 1, "1").expect("B2");
        ws.set_cell("main", 2, 1, "2").expect("B3");
        ws.set_cell("main", 3, 1, "3").expect("B4");
        ws.set_cell("bottom", 0, 1, "=SUM(main!B2:B4)")
            .expect("bottom B1");
        assert_eq!(ws.get_cell("bottom", 0, 1).unwrap(), Value::Number(6.0));
    }

    #[test]
    fn workspace_rejects_unknown_region() {
        let mut ws = WorkspaceHandle::new();
        let err = ws.set_cell("side", 0, 0, "1").expect_err("unknown");
        assert!(err.contains("unknown region"), "{err}");
        assert!(ws.get_cell("side", 0, 0).is_err());
    }

    #[test]
    fn workspace_region_names_are_case_insensitive() {
        let mut ws = WorkspaceHandle::new();
        ws.set_cell("MAIN", 0, 0, "4").expect("MAIN");
        ws.set_cell("Bottom", 0, 0, "=main!A1").expect("Bottom");
        assert_eq!(ws.get_cell("BOTTOM", 0, 0).unwrap(), Value::Number(4.0));
    }

    #[test]
    fn workspace_undo_cross_region_recalculates_dependents() {
        let mut ws = WorkspaceHandle::new();
        ws.set_cell("main", 0, 0, "10").expect("main A1");
        ws.set_cell("bottom", 0, 0, "=main!A1*2")
            .expect("bottom A1");
        ws.set_cell("main", 0, 0, "7").expect("main edit");
        assert_eq!(ws.get_cell("bottom", 0, 0).unwrap(), Value::Number(14.0));

        assert!(ws.undo());
        assert_eq!(ws.get_input("main", 0, 0).unwrap(), "10");
        assert_eq!(ws.get_cell("bottom", 0, 0).unwrap(), Value::Number(20.0));

        assert!(ws.redo());
        assert_eq!(ws.get_input("main", 0, 0).unwrap(), "7");
        assert_eq!(ws.get_cell("bottom", 0, 0).unwrap(), Value::Number(14.0));
    }

    #[test]
    fn workspace_undo_spans_main_and_bottom_edits() {
        let mut ws = WorkspaceHandle::new();
        ws.set_cell("main", 0, 0, "1").expect("main");
        ws.set_cell("bottom", 0, 0, "x").expect("bottom");
        assert!(ws.undo());
        assert_eq!(ws.get_input("bottom", 0, 0).unwrap(), "");
        assert_eq!(ws.get_input("main", 0, 0).unwrap(), "1");
        assert!(ws.undo());
        assert_eq!(ws.get_input("main", 0, 0).unwrap(), "");
    }

    #[test]
    fn workspace_clear_history_keeps_values() {
        let mut ws = WorkspaceHandle::new();
        ws.set_cell("main", 0, 0, "1").expect("A1");
        ws.clear_history();
        assert!(!ws.can_undo());
        assert_eq!(ws.get_input("main", 0, 0).unwrap(), "1");
    }

    #[test]
    fn workspace_new_edit_after_undo_clears_redo() {
        let mut ws = WorkspaceHandle::new();
        ws.set_cell("main", 0, 0, "1").expect("1");
        ws.set_cell("main", 0, 0, "2").expect("2");
        assert!(ws.undo());
        assert!(ws.can_redo());
        ws.set_cell("bottom", 0, 0, "y").expect("bottom");
        assert!(!ws.can_redo());
        assert!(ws.undo());
        assert_eq!(ws.get_input("bottom", 0, 0).unwrap(), "");
    }
}
