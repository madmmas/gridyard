//! The WASM boundary for Gridyard — the only crate that touches
//! `wasm-bindgen` / `js-sys`. See `docs/01-grid-engine-core-spec.md`.
//!
//! JS usage (single region):
//! ```ignore
//! import init, { create_grid } from "./gridyard_wasm.js";
//! await init();
//! const g = create_grid();
//! g.set_cell(0, 0, "10");
//! g.set_cell(0, 1, "=A1*2");
//! g.get_cell(0, 1); // { type: "number", value: 20 }
//! ```
//!
//! JS usage (main + bottom):
//! ```ignore
//! import init, { create_workspace } from "./gridyard_wasm.js";
//! await init();
//! const ws = create_workspace();
//! ws.set_cell("main", 0, 0, "10");
//! ws.set_cell("bottom", 0, 0, "=main!A1*2");
//! ws.get_cell("bottom", 0, 0); // { type: "number", value: 20 }
//! ```

mod handle;
mod js_value;

use wasm_bindgen::prelude::*;

pub use handle::{GridHandle, WorkspaceHandle};

use crate::js_value::value_to_js;

/// JS-facing grid handle wrapping the native single-region engine.
#[wasm_bindgen]
pub struct Grid {
    inner: GridHandle,
}

#[wasm_bindgen]
impl Grid {
    /// Sets the cell at zero-based `(row, col)` from a literal or `=formula`.
    ///
    /// Recalculates dependents before returning.
    #[wasm_bindgen(js_name = set_cell)]
    pub fn set_cell(&mut self, row: u32, col: u32, input: &str) -> Result<(), JsValue> {
        self.inner
            .set_cell(row, col, input)
            .map_err(|e| JsValue::from_str(&e))
    }

    /// Returns the computed cell value as a plain object:
    /// `{ type: "number"|"text"|"bool"|"empty"|"error"|"array", ... }`.
    #[wasm_bindgen(js_name = get_cell)]
    pub fn get_cell(&self, row: u32, col: u32) -> Result<JsValue, JsValue> {
        value_to_js(&self.inner.get_cell(row, col))
    }

    /// Returns the raw user input (literal or `=formula`) for the formula bar.
    #[wasm_bindgen(js_name = get_input)]
    pub fn get_input(&self, row: u32, col: u32) -> String {
        self.inner.get_input(row, col)
    }

    /// Undoes the most recent cell edit. Returns `true` when something changed.
    #[wasm_bindgen]
    pub fn undo(&mut self) -> bool {
        self.inner.undo()
    }

    /// Redoes the most recently undone cell edit. Returns `true` when something changed.
    #[wasm_bindgen]
    pub fn redo(&mut self) -> bool {
        self.inner.redo()
    }

    /// Returns whether [`Self::undo`] would apply a command.
    #[wasm_bindgen(js_name = can_undo)]
    pub fn can_undo(&self) -> bool {
        self.inner.can_undo()
    }

    /// Returns whether [`Self::redo`] would apply a command.
    #[wasm_bindgen(js_name = can_redo)]
    pub fn can_redo(&self) -> bool {
        self.inner.can_redo()
    }

    /// Clears undo/redo history without changing cell values.
    #[wasm_bindgen(js_name = clear_history)]
    pub fn clear_history(&mut self) {
        self.inner.clear_history();
    }
}

/// Creates an empty single-region grid for use from JavaScript.
#[wasm_bindgen]
pub fn create_grid() -> Grid {
    Grid {
        inner: GridHandle::new(),
    }
}

/// JS-facing two-region workspace (`main` + `bottom`).
#[wasm_bindgen]
pub struct Workspace {
    inner: WorkspaceHandle,
}

#[wasm_bindgen]
impl Workspace {
    /// Sets a cell in `region` (`"main"` / `"bottom"`) from a literal or
    /// `=formula`. Cross-region refs like `=main!A1` are supported on bottom.
    #[wasm_bindgen(js_name = set_cell)]
    pub fn set_cell(
        &mut self,
        region: &str,
        row: u32,
        col: u32,
        input: &str,
    ) -> Result<(), JsValue> {
        self.inner
            .set_cell(region, row, col, input)
            .map_err(|e| JsValue::from_str(&e))
    }

    /// Returns the computed cell value in `region` as a plain object
    /// (same shape as [`Grid::get_cell`]).
    #[wasm_bindgen(js_name = get_cell)]
    pub fn get_cell(&self, region: &str, row: u32, col: u32) -> Result<JsValue, JsValue> {
        let value = self
            .inner
            .get_cell(region, row, col)
            .map_err(|e| JsValue::from_str(&e))?;
        value_to_js(&value)
    }

    /// Returns the raw user input in `region` for the formula bar.
    #[wasm_bindgen(js_name = get_input)]
    pub fn get_input(&self, region: &str, row: u32, col: u32) -> Result<String, JsValue> {
        self.inner
            .get_input(region, row, col)
            .map_err(|e| JsValue::from_str(&e))
    }
}

/// Creates an empty two-region workspace (`main` + `bottom`) for JavaScript.
#[wasm_bindgen]
pub fn create_workspace() -> Workspace {
    Workspace {
        inner: WorkspaceHandle::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use gridyard_core::Value;

    #[test]
    fn create_grid_wires_set_and_get() {
        let mut grid = create_grid();
        grid.inner.set_cell(0, 0, "3").unwrap();
        grid.inner.set_cell(1, 0, "=A1+7").unwrap();
        assert_eq!(grid.inner.get_cell(1, 0), Value::Number(10.0));
    }

    #[test]
    fn create_workspace_wires_cross_region_set_and_get() {
        let mut ws = create_workspace();
        ws.inner.set_cell("main", 0, 0, "5").unwrap();
        ws.inner.set_cell("bottom", 0, 0, "=main!A1+1").unwrap();
        assert_eq!(
            ws.inner.get_cell("bottom", 0, 0).unwrap(),
            Value::Number(6.0)
        );

        ws.inner.set_cell("main", 0, 0, "9").unwrap();
        assert_eq!(
            ws.inner.get_cell("bottom", 0, 0).unwrap(),
            Value::Number(10.0)
        );
    }
}
