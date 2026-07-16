//! Sort and filter via display-order index vectors.
//!
//! See `docs/01-grid-engine-core-spec.md` (Sorting / Filtering): reorder and
//! hide rows by changing an index list only — never move underlying cells.
//! Formulas keep resolving by stable [`CellId`] regardless of display order.

use std::cmp::Ordering;

use gridyard_core::Value;

/// Ascending or descending order for one sort column.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SortDir {
    /// Smaller values first.
    Asc,
    /// Larger values first.
    Desc,
}

/// One column in a multi-column sort (primary key first).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct SortKey {
    /// 0-based column to compare.
    pub col: u32,
    /// Direction for this column.
    pub dir: SortDir,
}

impl SortKey {
    /// Ascending sort on `col`.
    pub fn asc(col: u32) -> Self {
        Self {
            col,
            dir: SortDir::Asc,
        }
    }

    /// Descending sort on `col`.
    pub fn desc(col: u32) -> Self {
        Self {
            col,
            dir: SortDir::Desc,
        }
    }
}

/// Read surface used when sorting by cell values.
pub trait CellValueSource {
    /// Computed (or literal) value at `(row, col)`; missing cells are [`Value::Empty`].
    fn get_value(&self, row: u32, col: u32) -> Value;
}

/// Display view over a contiguous block of underlying rows.
///
/// [`Self::visible_rows`] is the only list paint should walk. Sort and filter
/// rewrite that list; underlying row identities and cell storage stay fixed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RowView {
    /// First underlying row in this region (inclusive).
    start_row: u32,
    /// Number of underlying rows (including filtered-out ones).
    row_count: u32,
    /// Visible underlying row indices in current display order.
    visible: Vec<u32>,
}

impl RowView {
    /// Identity view over `row_count` rows starting at row 0.
    pub fn new(row_count: u32) -> Self {
        Self::from_range(0, row_count)
    }

    /// Identity view over `[start_row, start_row + row_count)`.
    ///
    /// `row_count == 0` yields an empty view.
    pub fn from_range(start_row: u32, row_count: u32) -> Self {
        let visible: Vec<u32> = (0..row_count).map(|i| start_row + i).collect();
        Self {
            start_row,
            row_count,
            visible,
        }
    }

    /// First underlying row (inclusive).
    pub fn start_row(&self) -> u32 {
        self.start_row
    }

    /// Number of underlying rows in the region (not the visible count).
    pub fn row_count(&self) -> u32 {
        self.row_count
    }

    /// All underlying row indices in natural order (never reordered by sort/filter).
    pub fn underlying_rows(&self) -> impl Iterator<Item = u32> + '_ {
        (0..self.row_count).map(|i| self.start_row + i)
    }

    /// Visible rows in current display order (for paint / UI).
    pub fn visible_rows(&self) -> &[u32] {
        &self.visible
    }

    /// Number of currently visible rows.
    pub fn visible_len(&self) -> usize {
        self.visible.len()
    }

    /// Underlying row at display index, if in range.
    pub fn row_at_display(&self, display_idx: usize) -> Option<u32> {
        self.visible.get(display_idx).copied()
    }

    /// Resets to identity order with every underlying row visible.
    pub fn reset(&mut self) {
        self.visible = (0..self.row_count).map(|i| self.start_row + i).collect();
    }

    /// Shows only rows for which `predicate(row)` is true.
    ///
    /// If the current visible list is a full permutation of the region
    /// (identity or post-sort), filtering preserves that relative order.
    /// After a prior filter (visible is a proper subset), matching is done
    /// against the full underlying range in natural order so previously
    /// hidden rows can reappear.
    pub fn filter(&mut self, mut predicate: impl FnMut(u32) -> bool) {
        let full: Vec<u32> = (0..self.row_count).map(|i| self.start_row + i).collect();
        let order = if is_permutation_of(&self.visible, &full) {
            self.visible.clone()
        } else {
            full
        };
        self.visible = order.into_iter().filter(|r| predicate(*r)).collect();
    }

    /// Reorders currently visible rows by `keys` (stable; equal keys keep order).
    ///
    /// Does not change underlying storage. Empty / missing cells sort as
    /// [`Value::Empty`]. Multi-column: earlier entries in `keys` win.
    pub fn sort_by(&mut self, keys: &[SortKey], source: &impl CellValueSource) {
        if keys.is_empty() || self.visible.len() < 2 {
            return;
        }
        self.visible
            .sort_by(|&a, &b| compare_rows(a, b, keys, source));
    }
}

fn is_permutation_of(visible: &[u32], full: &[u32]) -> bool {
    if visible.len() != full.len() {
        return false;
    }
    let mut sorted_vis = visible.to_vec();
    let mut sorted_full = full.to_vec();
    sorted_vis.sort_unstable();
    sorted_full.sort_unstable();
    sorted_vis == sorted_full
}

fn compare_rows(
    row_a: u32,
    row_b: u32,
    keys: &[SortKey],
    source: &impl CellValueSource,
) -> Ordering {
    for key in keys {
        let va = source.get_value(row_a, key.col);
        let vb = source.get_value(row_b, key.col);
        let mut ord = compare_sort_values(&va, &vb);
        if key.dir == SortDir::Desc {
            ord = ord.reverse();
        }
        if ord != Ordering::Equal {
            return ord;
        }
    }
    Ordering::Equal
}

/// Spreadsheet-ish value ordering (numbers before non-numeric text).
fn compare_sort_values(a: &Value, b: &Value) -> Ordering {
    match (a.coerce_number(), b.coerce_number()) {
        (Some(x), Some(y)) => x.partial_cmp(&y).unwrap_or(Ordering::Equal),
        (Some(_), None) => Ordering::Less,
        (None, Some(_)) => Ordering::Greater,
        (None, None) => match (a.coerce_text(), b.coerce_text()) {
            (Some(x), Some(y)) => x.cmp(&y),
            _ => Ordering::Equal,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::undo::{CellEditCommand, UndoStack};
    use gridyard_core::{cell_id, unpack_cell_id, Cell, SparseGrid};
    use std::collections::HashMap;

    #[derive(Default)]
    struct MapSheet {
        values: HashMap<(u32, u32), Value>,
        inputs: HashMap<(u32, u32), String>,
    }

    impl MapSheet {
        fn set(&mut self, row: u32, col: u32, input: &str, value: Value) {
            self.inputs.insert((row, col), input.to_string());
            self.values.insert((row, col), value);
        }

        fn get_input(&self, row: u32, col: u32) -> String {
            self.inputs.get(&(row, col)).cloned().unwrap_or_default()
        }

        fn set_input(&mut self, row: u32, col: u32, input: &str) {
            if input.is_empty() {
                self.inputs.remove(&(row, col));
            } else {
                self.inputs.insert((row, col), input.to_string());
            }
        }
    }

    impl CellValueSource for MapSheet {
        fn get_value(&self, row: u32, col: u32) -> Value {
            self.values
                .get(&(row, col))
                .cloned()
                .unwrap_or(Value::Empty)
        }
    }

    #[test]
    fn identity_view_lists_all_rows() {
        let view = RowView::new(4);
        assert_eq!(view.visible_rows(), &[0, 1, 2, 3]);
        assert_eq!(view.row_count(), 4);
        assert_eq!(view.row_at_display(2), Some(2));
        assert_eq!(view.underlying_rows().collect::<Vec<_>>(), vec![0, 1, 2, 3]);
    }

    #[test]
    fn sort_does_not_change_underlying_storage() {
        let mut sheet = MapSheet::default();
        sheet.set(0, 0, "c", Value::Text("c".into()));
        sheet.set(1, 0, "a", Value::Text("a".into()));
        sheet.set(2, 0, "b", Value::Text("b".into()));

        let snapshot: Vec<_> = [(0u32, 0u32), (1, 0), (2, 0)]
            .into_iter()
            .map(|(r, c)| (cell_id(r, c), sheet.get_value(r, c)))
            .collect();

        let mut view = RowView::new(3);
        view.sort_by(&[SortKey::asc(0)], &sheet);

        assert_eq!(view.visible_rows(), &[1, 2, 0]);
        for (id, expected) in &snapshot {
            let (r, c) = unpack_cell_id(*id);
            assert_eq!(&sheet.get_value(r, c), expected);
        }
        assert_eq!(sheet.get_value(0, 0), Value::Text("c".into()));
        assert_eq!(sheet.get_value(1, 0), Value::Text("a".into()));
    }

    #[test]
    fn multi_column_sort_uses_secondary_key() {
        let mut sheet = MapSheet::default();
        sheet.set(0, 0, "Sales", Value::Text("Sales".into()));
        sheet.set(0, 1, "Zoe", Value::Text("Zoe".into()));
        sheet.set(1, 0, "Eng", Value::Text("Eng".into()));
        sheet.set(1, 1, "Ann", Value::Text("Ann".into()));
        sheet.set(2, 0, "Sales", Value::Text("Sales".into()));
        sheet.set(2, 1, "Amy", Value::Text("Amy".into()));
        sheet.set(3, 0, "Eng", Value::Text("Eng".into()));
        sheet.set(3, 1, "Bob", Value::Text("Bob".into()));

        let mut view = RowView::new(4);
        view.sort_by(&[SortKey::asc(0), SortKey::asc(1)], &sheet);
        assert_eq!(view.visible_rows(), &[1, 3, 2, 0]);
    }

    #[test]
    fn sort_is_stable_for_equal_keys() {
        let mut sheet = MapSheet::default();
        sheet.set(0, 0, "1", Value::Number(1.0));
        sheet.set(1, 0, "1", Value::Number(1.0));
        sheet.set(2, 0, "1", Value::Number(1.0));
        sheet.set(3, 0, "0", Value::Number(0.0));

        let mut view = RowView::new(4);
        view.sort_by(&[SortKey::asc(0)], &sheet);
        assert_eq!(view.visible_rows(), &[3, 0, 1, 2]);
    }

    #[test]
    fn descending_sort() {
        let mut sheet = MapSheet::default();
        sheet.set(0, 0, "1", Value::Number(1.0));
        sheet.set(1, 0, "3", Value::Number(3.0));
        sheet.set(2, 0, "2", Value::Number(2.0));

        let mut view = RowView::new(3);
        view.sort_by(&[SortKey::desc(0)], &sheet);
        assert_eq!(view.visible_rows(), &[1, 2, 0]);
    }

    #[test]
    fn filter_hides_rows_without_removing_storage() {
        let mut grid = SparseGrid::new();
        grid.set_cell(cell_id(0, 0), Cell::new("keep", Value::Text("keep".into())));
        grid.set_cell(cell_id(1, 0), Cell::new("hide", Value::Text("hide".into())));
        grid.set_cell(
            cell_id(2, 0),
            Cell::new("keep2", Value::Text("keep2".into())),
        );
        // Dependent formula still points at A2 by stable address.
        grid.set_cell(cell_id(3, 0), Cell::new("=A2", Value::Text("hide".into())));

        let mut view = RowView::new(4);
        // Hide only the source row whose *input* is the literal "hide".
        view.filter(|row| {
            grid.get_cell(cell_id(row, 0))
                .map(|c| c.input.as_str() != "hide")
                .unwrap_or(true)
        });

        assert_eq!(view.visible_rows(), &[0, 2, 3]);
        assert_eq!(
            grid.get_cell(cell_id(1, 0)).map(|c| &c.value),
            Some(&Value::Text("hide".into()))
        );
        assert_eq!(
            grid.get_cell(cell_id(3, 0)).map(|c| c.input.as_str()),
            Some("=A2")
        );
        assert_eq!(grid.len(), 4);
    }

    #[test]
    fn filter_then_formula_address_still_resolves() {
        let mut sheet = MapSheet::default();
        sheet.set(0, 0, "10", Value::Number(10.0));
        sheet.set(1, 0, "20", Value::Number(20.0));
        sheet.set(2, 0, "=A1", Value::Number(10.0));

        let mut view = RowView::new(3);
        view.filter(|row| row != 0);
        assert_eq!(view.visible_rows(), &[1, 2]);
        assert_eq!(sheet.get_value(0, 0), Value::Number(10.0));
        assert_eq!(sheet.get_value(2, 0), Value::Number(10.0));
    }

    #[test]
    fn sort_then_undo_edit_still_works() {
        let mut sheet = MapSheet::default();
        sheet.set(0, 0, "c", Value::Text("c".into()));
        sheet.set(1, 0, "a", Value::Text("a".into()));
        sheet.set(2, 0, "b", Value::Text("b".into()));

        let mut stack = UndoStack::new();
        let old = sheet.get_input(1, 0);
        sheet.set_input(1, 0, "a!");
        stack.push_edit(CellEditCommand {
            cell: cell_id(1, 0),
            old_input: old,
            new_input: "a!".into(),
        });

        let mut view = RowView::new(3);
        view.sort_by(&[SortKey::asc(0)], &sheet);
        assert_eq!(view.visible_rows().first().copied(), Some(1));
        assert_eq!(sheet.get_input(1, 0), "a!");

        let cmd = stack.undo().expect("undo");
        let (row, col) = unpack_cell_id(cmd.cell);
        sheet.set_input(row, col, &cmd.old_input);
        assert_eq!(sheet.get_input(1, 0), "a");
        assert_eq!(view.visible_rows().first().copied(), Some(1));
    }

    #[test]
    fn reset_restores_identity_after_sort_and_filter() {
        let mut sheet = MapSheet::default();
        sheet.set(0, 0, "2", Value::Number(2.0));
        sheet.set(1, 0, "1", Value::Number(1.0));
        sheet.set(2, 0, "3", Value::Number(3.0));

        let mut view = RowView::new(3);
        view.sort_by(&[SortKey::asc(0)], &sheet);
        view.filter(|row| row != 2);
        assert_ne!(view.visible_rows(), &[0, 1, 2]);

        view.reset();
        assert_eq!(view.visible_rows(), &[0, 1, 2]);
    }

    #[test]
    fn table_driven_sort_and_filter() {
        struct Case {
            name: &'static str,
            values: &'static [(u32, u32, f64)],
            keys: &'static [SortKey],
            filter_odd_rows: bool,
            expected_visible: &'static [u32],
        }

        const ASC0: &[SortKey] = &[SortKey {
            col: 0,
            dir: SortDir::Asc,
        }];
        const DESC0: &[SortKey] = &[SortKey {
            col: 0,
            dir: SortDir::Desc,
        }];
        const NO_KEYS: &[SortKey] = &[];

        let cases = [
            Case {
                name: "asc col0",
                values: &[(0, 0, 3.0), (1, 0, 1.0), (2, 0, 2.0)],
                keys: ASC0,
                filter_odd_rows: false,
                expected_visible: &[1, 2, 0],
            },
            Case {
                name: "desc then filter odds",
                values: &[(0, 0, 1.0), (1, 0, 2.0), (2, 0, 3.0), (3, 0, 4.0)],
                keys: DESC0,
                filter_odd_rows: true,
                expected_visible: &[3, 1],
            },
            Case {
                name: "empty keys leaves order",
                values: &[(0, 0, 9.0), (1, 0, 1.0)],
                keys: NO_KEYS,
                filter_odd_rows: false,
                expected_visible: &[0, 1],
            },
        ];

        for case in cases {
            let mut sheet = MapSheet::default();
            let mut max_row = 0u32;
            for &(r, c, n) in case.values {
                sheet.set(r, c, &n.to_string(), Value::Number(n));
                max_row = max_row.max(r);
            }
            let mut view = RowView::new(max_row + 1);
            view.sort_by(case.keys, &sheet);
            if case.filter_odd_rows {
                view.filter(|row| row % 2 == 1);
            }
            assert_eq!(
                view.visible_rows(),
                case.expected_visible,
                "case {}",
                case.name
            );
        }
    }

    #[test]
    fn from_range_offsets_row_ids() {
        let mut sheet = MapSheet::default();
        sheet.set(10, 0, "b", Value::Text("b".into()));
        sheet.set(11, 0, "a", Value::Text("a".into()));
        sheet.set(12, 0, "c", Value::Text("c".into()));

        let mut view = RowView::from_range(10, 3);
        assert_eq!(view.visible_rows(), &[10, 11, 12]);
        view.sort_by(&[SortKey::asc(0)], &sheet);
        assert_eq!(view.visible_rows(), &[11, 10, 12]);
    }

    #[test]
    fn empty_view() {
        let view = RowView::new(0);
        assert!(view.visible_rows().is_empty());
        assert_eq!(view.visible_len(), 0);
        assert_eq!(view.row_at_display(0), None);
    }
}
