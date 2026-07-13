//! A single grid cell: raw input, computed value, and style reference.
//!
//! See `docs/01-grid-engine-core-spec.md` (Internal data model / Styling).

use crate::value::Value;

/// Index into the shared style table.
///
/// Style definitions themselves live elsewhere; cells only store this
/// placeholder id so identical formatting is not duplicated per cell.
pub type StyleId = u32;

/// Style id used when a cell has no explicit formatting.
pub const DEFAULT_STYLE_ID: StyleId = 0;

/// One cell in the sparse sheet.
///
/// Holds the raw user input (literal text or a formula string), the
/// computed [`Value`], and a [`StyleId`] into the shared style table.
#[derive(Debug, Clone, PartialEq)]
pub struct Cell {
    /// Raw input as entered by the user (e.g. `"42"`, `"hello"`, `"=A1+1"`).
    pub input: String,
    /// Computed or literal value.
    pub value: Value,
    /// Shared style table index; [`DEFAULT_STYLE_ID`] when unset.
    pub style_id: StyleId,
}

impl Cell {
    /// Builds a cell with the default style id.
    pub fn new(input: impl Into<String>, value: Value) -> Self {
        Self {
            input: input.into(),
            value,
            style_id: DEFAULT_STYLE_ID,
        }
    }

    /// Returns `true` when this cell has no input and an empty value.
    ///
    /// Such cells must not be retained in sparse storage.
    pub fn is_empty(&self) -> bool {
        self.input.is_empty() && self.value.is_empty()
    }
}

impl Default for Cell {
    fn default() -> Self {
        Self::new(String::new(), Value::Empty)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::value::ErrorKind;

    #[test]
    fn new_uses_default_style() {
        let cell = Cell::new("42", Value::Number(42.0));
        assert_eq!(cell.input, "42");
        assert_eq!(cell.value, Value::Number(42.0));
        assert_eq!(cell.style_id, DEFAULT_STYLE_ID);
    }

    #[test]
    fn is_empty_requires_blank_input_and_empty_value() {
        let cases: &[(Cell, bool)] = &[
            (Cell::default(), true),
            (Cell::new("", Value::Empty), true),
            (Cell::new(" ", Value::Empty), false),
            (Cell::new("", Value::Number(0.0)), false),
            (Cell::new("=A1", Value::Empty), false),
            (Cell::new("", Value::Error(ErrorKind::Ref)), false),
        ];

        for (cell, expected) in cases {
            assert_eq!(cell.is_empty(), *expected, "is_empty for {cell:?}");
        }
    }

    #[test]
    fn styled_but_otherwise_empty_is_still_empty_for_storage() {
        // Style alone does not keep a blank cell in the sparse map; the
        // style table can re-apply defaults when the cell is absent.
        let cell = Cell {
            style_id: 7,
            ..Cell::default()
        };
        assert!(cell.is_empty());
    }
}
