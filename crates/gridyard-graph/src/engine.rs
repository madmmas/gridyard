//! Sheet engine: sparse grid + formulas + incremental recalculation.

use std::collections::HashMap;

use gridyard_core::{cell_id, Cell, CellId, ErrorKind, SparseGrid, Value, DEFAULT_STYLE_ID};
use gridyard_formula::{evaluate_with_cells, parse_formula, Ast, EvalEnv, ParseError};

use crate::dep_graph::DepGraph;

/// Coordinates a sparse grid, formula ASTs, and the dependency graph.
#[derive(Debug, Default)]
pub struct SheetEngine {
    grid: SparseGrid,
    formulas: HashMap<CellId, Ast>,
    graph: DepGraph,
    /// Last successful recalculation order (for tests / debugging).
    last_order: Vec<CellId>,
}

impl SheetEngine {
    /// Creates an empty sheet.
    pub fn new() -> Self {
        Self::default()
    }

    /// Sets a cell from user input and incrementally recalculates dependents.
    ///
    /// Inputs starting with `=` are parsed as formulas; anything else is a
    /// literal (number, bool, or text). Unparseable formulas are stored with
    /// [`Value::Error`]([`ErrorKind::Value`]) so callers can show an error
    /// cell without rejecting the edit.
    pub fn set_cell(&mut self, id: CellId, input: &str) -> Result<(), ParseError> {
        let trimmed = input.trim();
        if let Some(formula) = trimmed.strip_prefix('=') {
            match parse_formula(formula) {
                Ok(ast) => {
                    let precedents = ast.referenced_cells();
                    self.formulas.insert(id, ast);
                    self.graph.set_precedents(id, precedents);
                    // Placeholder until recalc fills the computed value.
                    self.write_cell(id, trimmed.to_string(), Value::Empty);
                }
                Err(_) => {
                    self.formulas.remove(&id);
                    self.graph.clear_precedents(id);
                    self.write_cell(id, trimmed.to_string(), Value::Error(ErrorKind::Value));
                }
            }
        } else {
            self.formulas.remove(&id);
            self.graph.clear_precedents(id);
            let value = parse_literal(trimmed);
            self.write_cell(id, trimmed.to_string(), value);
        }

        self.graph.mark_dirty(id);
        self.recalculate();
        Ok(())
    }

    /// Returns the computed value for `id`, or [`Value::Empty`] if absent.
    pub fn get_value(&self, id: CellId) -> Value {
        self.grid
            .get_cell(id)
            .map(|c| c.value.clone())
            .unwrap_or(Value::Empty)
    }

    /// Returns the raw user input for `id` (literal or `=formula`), or `""`.
    pub fn get_input(&self, id: CellId) -> String {
        self.grid
            .get_cell(id)
            .map(|c| c.input.clone())
            .unwrap_or_default()
    }

    /// Borrows the last recalculation order (dirty cells only, topo-sorted).
    pub fn last_recalc_order(&self) -> &[CellId] {
        &self.last_order
    }

    fn recalculate(&mut self) {
        match self.graph.take_dirty_order() {
            Ok(order) => {
                self.last_order = order.clone();
                for id in order {
                    self.recalc_one(id);
                }
            }
            Err(cyclic) => {
                self.last_order.clear();
                for id in &cyclic {
                    self.set_value_only(*id, Value::Error(ErrorKind::Circular));
                }
            }
        }
    }

    fn recalc_one(&mut self, id: CellId) {
        let Some(ast) = self.formulas.get(&id).cloned() else {
            return;
        };
        let value = {
            let grid = &self.grid;
            evaluate_with_cells(&ast, &EvalEnv::default(), |cid| {
                grid.get_cell(cid)
                    .map(|c| c.value.clone())
                    .unwrap_or(Value::Empty)
            })
        };
        self.set_value_only(id, value);
    }

    fn set_value_only(&mut self, id: CellId, value: Value) {
        let input = self
            .grid
            .get_cell(id)
            .map(|c| c.input.clone())
            .unwrap_or_default();
        self.write_cell(id, input, value);
    }

    fn write_cell(&mut self, id: CellId, input: String, value: Value) {
        self.grid.set_cell(
            id,
            Cell {
                input,
                value,
                style_id: DEFAULT_STYLE_ID,
            },
        );
    }
}

fn parse_literal(input: &str) -> Value {
    if input.is_empty() {
        return Value::Empty;
    }
    if input.eq_ignore_ascii_case("TRUE") {
        return Value::Bool(true);
    }
    if input.eq_ignore_ascii_case("FALSE") {
        return Value::Bool(false);
    }
    if let Ok(n) = input.parse::<f64>() {
        return Value::Number(n);
    }
    Value::Text(input.to_string())
}

/// Convenience: `A1`-style address to [`CellId`] for tests and demos.
pub fn a1(addr: &str) -> CellId {
    let bytes = addr.as_bytes();
    let mut i = 0;
    while i < bytes.len() && bytes[i].is_ascii_alphabetic() {
        i += 1;
    }
    let mut col: u32 = 0;
    for ch in addr[..i].chars() {
        col = col * 26 + u32::from(ch.to_ascii_uppercase() as u8 - b'A') + 1;
    }
    let row: u32 = addr[i..].parse().expect("row");
    cell_id(row - 1, col - 1)
}

#[cfg(test)]
mod tests {
    use super::*;
    use gridyard_core::unpack_cell_id;

    #[test]
    fn linear_chain_recalculates_dependents_in_order() {
        let mut eng = SheetEngine::new();
        eng.set_cell(a1("A1"), "1").unwrap();
        eng.set_cell(a1("B1"), "=A1+1").unwrap();
        eng.set_cell(a1("C1"), "=B1+1").unwrap();
        assert_eq!(eng.get_value(a1("C1")), Value::Number(3.0));

        eng.set_cell(a1("A1"), "10").unwrap();
        assert_eq!(eng.get_value(a1("B1")), Value::Number(11.0));
        assert_eq!(eng.get_value(a1("C1")), Value::Number(12.0));
        // Dirty set is A1 (edited) plus B1, C1 — topo A, B, C.
        assert_eq!(eng.last_recalc_order(), &[a1("A1"), a1("B1"), a1("C1")]);
    }

    #[test]
    fn diamond_dependencies() {
        let mut eng = SheetEngine::new();
        eng.set_cell(a1("A1"), "2").unwrap();
        eng.set_cell(a1("B1"), "=A1*2").unwrap();
        eng.set_cell(a1("C1"), "=A1*3").unwrap();
        eng.set_cell(a1("D1"), "=B1+C1").unwrap();
        assert_eq!(eng.get_value(a1("D1")), Value::Number(10.0));

        eng.set_cell(a1("A1"), "5").unwrap();
        assert_eq!(eng.get_value(a1("B1")), Value::Number(10.0));
        assert_eq!(eng.get_value(a1("C1")), Value::Number(15.0));
        assert_eq!(eng.get_value(a1("D1")), Value::Number(25.0));

        let order = eng.last_recalc_order();
        let pos = |id| order.iter().position(|c| *c == id).unwrap();
        assert!(pos(a1("A1")) < pos(a1("B1")));
        assert!(pos(a1("A1")) < pos(a1("C1")));
        assert!(pos(a1("B1")) < pos(a1("D1")));
        assert!(pos(a1("C1")) < pos(a1("D1")));
    }

    #[test]
    fn circular_reference_sets_circular_error() {
        let mut eng = SheetEngine::new();
        eng.set_cell(a1("A1"), "=B1").unwrap();
        eng.set_cell(a1("B1"), "=A1").unwrap();
        assert_eq!(eng.get_value(a1("A1")), Value::Error(ErrorKind::Circular));
        assert_eq!(eng.get_value(a1("B1")), Value::Error(ErrorKind::Circular));
    }

    #[test]
    fn disjoint_graphs_are_not_touched() {
        let mut eng = SheetEngine::new();
        eng.set_cell(a1("A1"), "1").unwrap();
        eng.set_cell(a1("B1"), "=A1+1").unwrap();
        eng.set_cell(a1("Z1"), "100").unwrap();
        eng.set_cell(a1("Z2"), "=Z1+1").unwrap();
        assert_eq!(eng.get_value(a1("Z2")), Value::Number(101.0));

        eng.set_cell(a1("A1"), "5").unwrap();
        assert_eq!(eng.get_value(a1("B1")), Value::Number(6.0));
        assert_eq!(eng.get_value(a1("Z2")), Value::Number(101.0));
        assert!(!eng.last_recalc_order().contains(&a1("Z1")));
        assert!(!eng.last_recalc_order().contains(&a1("Z2")));
    }

    #[test]
    fn unpack_roundtrip_via_a1_helper() {
        let id = a1("AB10");
        assert_eq!(unpack_cell_id(id), (9, 27));
    }

    #[test]
    fn get_input_returns_raw_user_text() {
        let mut eng = SheetEngine::new();
        eng.set_cell(a1("A1"), "10").unwrap();
        eng.set_cell(a1("B1"), "=A1*2").unwrap();
        assert_eq!(eng.get_input(a1("A1")), "10");
        assert_eq!(eng.get_input(a1("B1")), "=A1*2");
        assert_eq!(eng.get_input(a1("C1")), "");
    }

    #[test]
    fn unparseable_formula_stores_error_value() {
        let mut eng = SheetEngine::new();
        eng.set_cell(a1("A1"), "=1+").unwrap();
        assert_eq!(eng.get_input(a1("A1")), "=1+");
        assert_eq!(eng.get_value(a1("A1")), Value::Error(ErrorKind::Value));
    }
}
