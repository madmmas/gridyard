//! Two independent sheet engines with cross-region formula reads.
//!
//! Per `docs/04-layout-and-permission-engine-spec.md`, main and bottom each
//! keep their own dependency graph. Bottom may read main via `main!A1`
//! refs; main does not learn about bottom's dependents.

use gridyard_core::{CellId, ErrorKind, Value};
use gridyard_formula::ParseError;

use crate::engine::SheetEngine;

/// Named workspace region (main + bottom only for now).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Region {
    /// Primary grid region.
    Main,
    /// Bottom Aggregate region (may read `main!…` cells).
    Bottom,
}

impl Region {
    /// Formula qualifier string (`main` / `bottom`).
    pub fn as_str(self) -> &'static str {
        match self {
            Region::Main => "main",
            Region::Bottom => "bottom",
        }
    }

    fn parse(name: &str) -> Option<Self> {
        if name.eq_ignore_ascii_case("main") {
            Some(Region::Main)
        } else if name.eq_ignore_ascii_case("bottom") {
            Some(Region::Bottom)
        } else {
            None
        }
    }
}

/// Owns two independent [`SheetEngine`]s and wires cross-region reads.
#[derive(Debug, Default)]
pub struct WorkspaceEngine {
    main: SheetEngine,
    bottom: SheetEngine,
}

impl WorkspaceEngine {
    /// Creates an empty two-region workspace.
    pub fn new() -> Self {
        Self::default()
    }

    /// Sets a cell in `region` and recalculates that region's graph.
    ///
    /// When `region` is [`Region::Main`], any bottom formulas that read the
    /// changed main cells are dirtied and recalculated afterward — without
    /// adding edges into main's own graph.
    pub fn set_cell(&mut self, region: Region, id: CellId, input: &str) -> Result<(), ParseError> {
        match region {
            Region::Main => {
                {
                    let WorkspaceEngine { main, bottom: _ } = self;
                    main.set_cell(id, input)?;
                }
                let changed = self.main.last_recalc_order().to_vec();
                let WorkspaceEngine { main, bottom } = self;
                bottom.propagate_external_changes(Region::Main.as_str(), &changed, |reg, cell| {
                    resolve_from_main(main, reg, cell)
                });
            }
            Region::Bottom => {
                let WorkspaceEngine { main, bottom } = self;
                bottom.set_cell_with_external(id, input, |reg, cell| {
                    resolve_from_main(main, reg, cell)
                })?;
            }
        }
        Ok(())
    }

    /// Returns the computed value for a cell in `region`.
    pub fn get_value(&self, region: Region, id: CellId) -> Value {
        self.engine(region).get_value(id)
    }

    /// Returns the raw user input for a cell in `region`.
    pub fn get_input(&self, region: Region, id: CellId) -> String {
        self.engine(region).get_input(id)
    }

    /// Borrows the last recalc order for `region` (same-region dirty set).
    pub fn last_recalc_order(&self, region: Region) -> &[CellId] {
        self.engine(region).last_recalc_order()
    }

    fn engine(&self, region: Region) -> &SheetEngine {
        match region {
            Region::Main => &self.main,
            Region::Bottom => &self.bottom,
        }
    }
}

fn resolve_from_main(main: &SheetEngine, region: &str, cell: CellId) -> Value {
    match Region::parse(region) {
        Some(Region::Main) => main.get_value(cell),
        // Bottom→bottom external refs and unknown regions are not wired.
        Some(Region::Bottom) | None => Value::Error(ErrorKind::Ref),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::a1;

    #[test]
    fn independent_engines_do_not_share_dirty_sets() {
        let mut ws = WorkspaceEngine::new();
        ws.set_cell(Region::Main, a1("A1"), "1").unwrap();
        ws.set_cell(Region::Main, a1("B1"), "=A1+1").unwrap();
        ws.set_cell(Region::Bottom, a1("A1"), "100").unwrap();
        ws.set_cell(Region::Bottom, a1("B1"), "=A1+1").unwrap();

        ws.set_cell(Region::Main, a1("A1"), "5").unwrap();
        assert_eq!(ws.get_value(Region::Main, a1("B1")), Value::Number(6.0));
        // Bottom has no main! refs — editing main must not touch bottom values
        // or leave a bottom dirty order from propagation.
        assert_eq!(ws.get_value(Region::Bottom, a1("B1")), Value::Number(101.0));
        assert_eq!(ws.get_value(Region::Bottom, a1("A1")), Value::Number(100.0));
        assert!(ws.last_recalc_order(Region::Bottom).is_empty());
        assert!(ws.last_recalc_order(Region::Main).contains(&a1("B1")));
    }

    #[test]
    fn table_driven_same_region_and_cross_region() {
        type Expect = Option<(Region, &'static str, Value)>;
        type Step = ((Region, &'static str, &'static str), Expect);

        let cases: &[(&str, &[Step])] = &[
            (
                "same-region regression",
                &[
                    ((Region::Main, "A1", "10"), None),
                    (
                        (Region::Main, "B1", "=A1*2"),
                        Some((Region::Main, "B1", Value::Number(20.0))),
                    ),
                    (
                        (Region::Main, "A1", "3"),
                        Some((Region::Main, "B1", Value::Number(6.0))),
                    ),
                ],
            ),
            (
                "cross-region single cell",
                &[
                    ((Region::Main, "A1", "7"), None),
                    (
                        (Region::Bottom, "A1", "=main!A1"),
                        Some((Region::Bottom, "A1", Value::Number(7.0))),
                    ),
                    (
                        (Region::Main, "A1", "11"),
                        Some((Region::Bottom, "A1", Value::Number(11.0))),
                    ),
                ],
            ),
            (
                "cross-region range aggregate",
                &[
                    ((Region::Main, "B2", "1"), None),
                    ((Region::Main, "B3", "2"), None),
                    ((Region::Main, "B4", "3"), None),
                    (
                        (Region::Bottom, "A1", "=SUM(main!B2:B4)"),
                        Some((Region::Bottom, "A1", Value::Number(6.0))),
                    ),
                    (
                        (Region::Main, "B3", "10"),
                        Some((Region::Bottom, "A1", Value::Number(14.0))),
                    ),
                ],
            ),
            (
                "missing region is ref error",
                &[(
                    (Region::Bottom, "A1", "=side!A1"),
                    Some((Region::Bottom, "A1", Value::Error(ErrorKind::Ref))),
                )],
            ),
            (
                "unknown region does not panic",
                &[(
                    (Region::Bottom, "A1", "=nope!Z9+1"),
                    Some((Region::Bottom, "A1", Value::Error(ErrorKind::Ref))),
                )],
            ),
        ];

        for &(name, steps) in cases {
            let mut ws = WorkspaceEngine::new();
            for ((region, addr, input), expected) in steps {
                ws.set_cell(*region, a1(addr), input)
                    .unwrap_or_else(|e| panic!("{name}: set {addr}: {e}"));
                if let Some((check_region, check_addr, want)) = expected {
                    assert_eq!(
                        ws.get_value(*check_region, a1(check_addr)),
                        *want,
                        "{name}: after `{input}` expected {check_addr} = {want:?}"
                    );
                }
            }
        }
    }

    #[test]
    fn main_recalc_order_excludes_bottom_cells() {
        let mut ws = WorkspaceEngine::new();
        ws.set_cell(Region::Main, a1("A1"), "1").unwrap();
        ws.set_cell(Region::Bottom, a1("A1"), "=main!A1*10")
            .unwrap();
        ws.set_cell(Region::Main, a1("A1"), "2").unwrap();

        assert_eq!(ws.get_value(Region::Bottom, a1("A1")), Value::Number(20.0));
        assert_eq!(ws.last_recalc_order(Region::Main), &[a1("A1")]);
        assert_eq!(ws.last_recalc_order(Region::Bottom), &[a1("A1")]);
    }

    #[test]
    fn blank_main_cell_reads_as_empty_not_panic() {
        let mut ws = WorkspaceEngine::new();
        // main!Z99 has never been written — Empty, not a crash.
        ws.set_cell(Region::Bottom, a1("A1"), "=main!Z99").unwrap();
        assert_eq!(ws.get_value(Region::Bottom, a1("A1")), Value::Empty);
    }
}
