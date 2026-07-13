//! Collect cell precedents from a formula AST (refs and expanded ranges).

use std::collections::BTreeSet;

use gridyard_core::{unpack_cell_id, CellId};

use crate::ast::{Ast, Expr, NodeId};

impl Ast {
    /// Returns every cell this formula reads, with ranges expanded.
    ///
    /// Order is sorted by [`CellId`] for stable dependency edges in tests.
    pub fn referenced_cells(&self) -> Vec<CellId> {
        let mut out = BTreeSet::new();
        self.collect_refs(self.root(), &mut out);
        out.into_iter().collect()
    }

    fn collect_refs(&self, id: NodeId, out: &mut BTreeSet<CellId>) {
        match self.node(id) {
            Expr::Number(_) | Expr::Text(_) | Expr::Bool(_) => {}
            Expr::CellRef(cell) => {
                out.insert(*cell);
            }
            Expr::Range { start, end } => {
                for cell in expand_range(*start, *end) {
                    out.insert(cell);
                }
            }
            Expr::Call { args, .. } => {
                for arg in args {
                    self.collect_refs(*arg, out);
                }
            }
            Expr::Unary { expr, .. } => self.collect_refs(*expr, out),
            Expr::Binary { left, right, .. } => {
                self.collect_refs(*left, out);
                self.collect_refs(*right, out);
            }
        }
    }
}

/// Expands an inclusive A1-style range into all covered cell ids.
pub fn expand_range(start: CellId, end: CellId) -> Vec<CellId> {
    let (r1, c1) = unpack_cell_id(start);
    let (r2, c2) = unpack_cell_id(end);
    let (rmin, rmax) = if r1 <= r2 { (r1, r2) } else { (r2, r1) };
    let (cmin, cmax) = if c1 <= c2 { (c1, c2) } else { (c2, c1) };

    let mut cells = Vec::new();
    for row in rmin..=rmax {
        for col in cmin..=cmax {
            cells.push(gridyard_core::cell_id(row, col));
        }
    }
    cells
}

#[cfg(test)]
mod tests {
    use crate::parse_formula;
    use gridyard_core::cell_id;

    #[test]
    fn collects_refs_and_expands_ranges() {
        let ast = parse_formula("A1+B2").unwrap();
        assert_eq!(ast.referenced_cells(), vec![cell_id(0, 0), cell_id(1, 1)]);

        let ast = parse_formula("SUM(A1:A3)").unwrap();
        assert_eq!(
            ast.referenced_cells(),
            vec![cell_id(0, 0), cell_id(1, 0), cell_id(2, 0)]
        );
    }
}
