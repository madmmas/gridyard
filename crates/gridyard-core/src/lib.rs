//! Cell storage, the sparse sheet model, `Value` types, and the shared
//! style table for Gridyard. See `docs/01-grid-engine-core-spec.md`.

mod cell;
mod grid;
mod value;

pub use cell::{Cell, StyleId, DEFAULT_STYLE_ID};
pub use grid::SparseGrid;
pub use value::{ErrorKind, Value};

/// A packed cell identifier: row in the high 32 bits, column in the low
/// 32 bits. Encoding it as a single `u64` instead of a string like
/// `"A1"` avoids string parsing/formatting on the hot path (every cell
/// lookup, every dependency graph edge) — see
/// `docs/01-grid-engine-core-spec.md`.
pub type CellId = u64;

/// Packs a `(row, col)` pair into a [`CellId`].
pub fn cell_id(row: u32, col: u32) -> CellId {
    ((row as u64) << 32) | (col as u64)
}

/// Unpacks a [`CellId`] back into its `(row, col)` pair.
pub fn unpack_cell_id(id: CellId) -> (u32, u32) {
    let row = (id >> 32) as u32;
    let col = (id & 0xFFFF_FFFF) as u32;
    (row, col)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn packs_and_unpacks_round_trip() {
        let cases: &[(u32, u32)] = &[
            (0, 0),
            (0, 1),
            (1, 0),
            (7, 3),
            (u32::MAX, u32::MAX),
            (1_048_575, 16_383),
        ];

        for &(row, col) in cases {
            let id = cell_id(row, col);
            assert_eq!(
                unpack_cell_id(id),
                (row, col),
                "round trip failed for row={row}, col={col}"
            );
        }
    }

    #[test]
    fn distinct_coordinates_produce_distinct_ids() {
        assert_ne!(cell_id(0, 1), cell_id(1, 0));
        assert_ne!(cell_id(2, 5), cell_id(5, 2));
    }

    #[test]
    fn row_dominates_the_high_bits() {
        // Row 1, col 0 should be strictly greater than any id with row 0,
        // since row occupies the high 32 bits.
        assert!(cell_id(1, 0) > cell_id(0, u32::MAX));
    }
}
