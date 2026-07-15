//! Relative formula reference adjustment for clipboard paste / fill.

use crate::a1::{format_a1, parse_a1};
use crate::lexer::{lex, TokenKind};

/// Shifts every local A1 cell/range reference in a formula by `(d_row, d_col)`.
///
/// - Literals (non-`=` inputs) are returned unchanged.
/// - Identifiers that are function names (`SUM(`) or region names (`main!`) are
///   left alone; only refs that parse as A1 (and are not followed by `(` / `!`)
///   are rewritten.
/// - Cross-region refs like `main!A1` still adjust the cell portion.
/// - If lexing fails, returns the original input unchanged (paste the literal).
///
/// Out-of-range shifts after saturating at `(0, 0)` clamp to `A1` rather than
/// erroring — callers still get a pasteable formula string.
pub fn shift_formula_refs(source: &str, d_row: i32, d_col: i32) -> String {
    let trimmed = source.trim_start();
    if !trimmed.starts_with('=') {
        return source.to_string();
    }
    if d_row == 0 && d_col == 0 {
        return source.to_string();
    }

    let Ok(tokens) = lex(source) else {
        return source.to_string();
    };

    let mut replacements: Vec<(usize, usize, String)> = Vec::new();
    for (i, tok) in tokens.iter().enumerate() {
        let TokenKind::Ident(ident) = &tok.kind else {
            continue;
        };
        let next = tokens.get(i + 1).map(|t| &t.kind);
        // Function call or region qualifier — not a cell ref.
        if matches!(next, Some(TokenKind::LParen | TokenKind::Bang)) {
            continue;
        }
        let Ok((row, col)) = parse_a1(ident, tok.start) else {
            continue;
        };
        let new_row = shift_coord(row, d_row);
        let new_col = shift_coord(col, d_col);
        replacements.push((tok.start, tok.end, format_a1(new_row, new_col)));
    }

    if replacements.is_empty() {
        return source.to_string();
    }

    apply_replacements(source, &replacements)
}

fn shift_coord(value: u32, delta: i32) -> u32 {
    let shifted = i64::from(value) + i64::from(delta);
    if shifted < 0 {
        0
    } else if shifted > i64::from(u32::MAX) {
        u32::MAX
    } else {
        shifted as u32
    }
}

fn apply_replacements(source: &str, replacements: &[(usize, usize, String)]) -> String {
    let mut out = source.to_string();
    for &(start, end, ref text) in replacements.iter().rev() {
        out.replace_range(start..end, text);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn literals_are_unchanged() {
        assert_eq!(shift_formula_refs("hello", 1, 1), "hello");
        assert_eq!(shift_formula_refs("42", 1, 0), "42");
    }

    #[test]
    fn shifts_relative_cell_refs() {
        // Copy =A1 from B1 → paste at C3: delta (+2, +1) → =B3
        assert_eq!(shift_formula_refs("=A1", 2, 1), "=B3");
        assert_eq!(shift_formula_refs("=A1+B2", 1, 0), "=A2+B3");
        assert_eq!(shift_formula_refs("=SUM(A1:A3)", 1, 1), "=SUM(B2:B4)");
        assert_eq!(shift_formula_refs("=main!A1", 1, 0), "=main!A2");
    }

    #[test]
    fn does_not_shift_function_names_or_region_names() {
        // LOG10 would otherwise look A1-shaped; leave it when followed by '('.
        assert_eq!(shift_formula_refs("=LOG10(A1)", 1, 0), "=LOG10(A2)");
        assert_eq!(shift_formula_refs("=SUM(1, 2)", 5, 5), "=SUM(1, 2)");
    }

    #[test]
    fn zero_delta_is_identity() {
        assert_eq!(shift_formula_refs("=A1+B2", 0, 0), "=A1+B2");
    }

    #[test]
    fn clamps_negative_shifts_to_origin() {
        assert_eq!(shift_formula_refs("=B2", -10, -10), "=A1");
    }

    #[test]
    fn table_driven_shifts() {
        let cases: &[(&str, i32, i32, &str)] = &[
            ("=A1", 0, 1, "=B1"),
            ("=A1", 1, 0, "=A2"),
            ("=Z1", 0, 1, "=AA1"),
            ("=B2*C3", -1, -1, "=A1*B2"),
            ("text", 3, 3, "text"),
        ];
        for &(src, dr, dc, expected) in cases {
            assert_eq!(
                shift_formula_refs(src, dr, dc),
                expected,
                "shift_formula_refs({src:?}, {dr}, {dc})"
            );
        }
    }
}
