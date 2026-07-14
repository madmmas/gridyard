//! Collect cell precedents from a formula AST (refs and expanded ranges).

use std::collections::BTreeSet;

use gridyard_core::{unpack_cell_id, CellId};

use crate::ast::{Ast, Expr, NodeId};

/// A cell read from another region (`main!A1`).
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct ExternalRef {
    /// Normalized lowercase region name (`main`, `bottom`, …).
    pub region: String,
    /// Cell within that region.
    pub cell: CellId,
}

impl Ast {
    /// Returns every same-region cell this formula reads, with ranges expanded.
    ///
    /// Order is sorted by [`CellId`] for stable dependency edges in tests.
    /// Cross-region refs are excluded — see [`Ast::referenced_external_cells`].
    pub fn referenced_cells(&self) -> Vec<CellId> {
        let mut out = BTreeSet::new();
        self.collect_refs(self.root(), &mut out);
        out.into_iter().collect()
    }

    /// Returns every cross-region cell this formula reads, with ranges expanded.
    ///
    /// Region names are normalized to lowercase. Order is sorted for stable
    /// dependency edges in tests.
    pub fn referenced_external_cells(&self) -> Vec<ExternalRef> {
        let mut out = BTreeSet::new();
        self.collect_external_refs(self.root(), &mut out);
        out.into_iter().collect()
    }

    fn collect_refs(&self, id: NodeId, out: &mut BTreeSet<CellId>) {
        match self.node(id) {
            Expr::Number(_)
            | Expr::Text(_)
            | Expr::Bool(_)
            | Expr::ExternalCellRef { .. }
            | Expr::ExternalRange { .. } => {}
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

    fn collect_external_refs(&self, id: NodeId, out: &mut BTreeSet<ExternalRef>) {
        match self.node(id) {
            Expr::Number(_)
            | Expr::Text(_)
            | Expr::Bool(_)
            | Expr::CellRef(_)
            | Expr::Range { .. } => {}
            Expr::ExternalCellRef { region, cell } => {
                out.insert(ExternalRef {
                    region: region.to_ascii_lowercase(),
                    cell: *cell,
                });
            }
            Expr::ExternalRange { region, start, end } => {
                let region = region.to_ascii_lowercase();
                for cell in expand_range(*start, *end) {
                    out.insert(ExternalRef {
                        region: region.clone(),
                        cell,
                    });
                }
            }
            Expr::Call { args, .. } => {
                for arg in args {
                    self.collect_external_refs(*arg, out);
                }
            }
            Expr::Unary { expr, .. } => self.collect_external_refs(*expr, out),
            Expr::Binary { left, right, .. } => {
                self.collect_external_refs(*left, out);
                self.collect_external_refs(*right, out);
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

    use super::ExternalRef;

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

    #[test]
    fn collects_external_refs_separately_from_local() {
        let ast = parse_formula("A1+main!B2").unwrap();
        assert_eq!(ast.referenced_cells(), vec![cell_id(0, 0)]);
        assert_eq!(
            ast.referenced_external_cells(),
            vec![ExternalRef {
                region: "main".into(),
                cell: cell_id(1, 1),
            }]
        );

        let ast = parse_formula("SUM(main!B2:B4)").unwrap();
        assert!(ast.referenced_cells().is_empty());
        assert_eq!(
            ast.referenced_external_cells(),
            vec![
                ExternalRef {
                    region: "main".into(),
                    cell: cell_id(1, 1),
                },
                ExternalRef {
                    region: "main".into(),
                    cell: cell_id(2, 1),
                },
                ExternalRef {
                    region: "main".into(),
                    cell: cell_id(3, 1),
                },
            ]
        );
    }
}
