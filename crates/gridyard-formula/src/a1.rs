//! A1-style cell reference parsing (`A1`, `B2`, `AA10`).
//!
//! Rows and columns are converted to 0-based indices for [`gridyard_core::cell_id`].

use crate::error::ParseError;

/// Parses an A1-style reference into `(row, col)` (both 0-based).
///
/// Column letters are case-insensitive (`a1` ≡ `A1`). The numeric row is
/// 1-based in the source and converted to 0-based here.
pub fn parse_a1(text: &str, position: usize) -> Result<(u32, u32), ParseError> {
    if text.is_empty() {
        return Err(ParseError::new(position, "empty cell reference"));
    }

    let bytes = text.as_bytes();
    let mut i = 0;
    while i < bytes.len() && bytes[i].is_ascii_alphabetic() {
        i += 1;
    }
    if i == 0 {
        return Err(ParseError::new(
            position,
            format!("expected column letters in cell reference `{text}`"),
        ));
    }
    if i == bytes.len() {
        return Err(ParseError::new(
            position,
            format!("missing row number in cell reference `{text}`"),
        ));
    }
    if !bytes[i..].iter().all(|b| b.is_ascii_digit()) {
        return Err(ParseError::new(
            position,
            format!("invalid cell reference `{text}`"),
        ));
    }

    let col = parse_column(&text[..i], position)?;
    let row = parse_row(&text[i..], position)?;
    Ok((row, col))
}

/// Formats 0-based `(row, col)` as an uppercase A1 reference (`A1`, `AA10`).
pub fn format_a1(row: u32, col: u32) -> String {
    format!("{}{}", format_column(col), row + 1)
}

fn format_column(mut col: u32) -> String {
    // 0-based → Excel-style base-26 letters (A=0 … Z=25, AA=26, …).
    let mut letters = Vec::new();
    loop {
        letters.push(char::from(b'A' + (col % 26) as u8));
        if col < 26 {
            break;
        }
        col = col / 26 - 1;
    }
    letters.reverse();
    letters.into_iter().collect()
}

fn parse_column(letters: &str, position: usize) -> Result<u32, ParseError> {
    let mut col: u32 = 0;
    for ch in letters.chars() {
        let digit = (ch.to_ascii_uppercase() as u8).saturating_sub(b'A');
        // Base-26, 1-indexed letters: A=1 … Z=26, then subtract 1 at the end.
        col = col
            .checked_mul(26)
            .and_then(|c| c.checked_add(u32::from(digit) + 1))
            .ok_or_else(|| {
                ParseError::new(position, format!("column `{letters}` is out of range"))
            })?;
    }
    Ok(col - 1)
}

fn parse_row(digits: &str, position: usize) -> Result<u32, ParseError> {
    let row_one_based: u32 = digits
        .parse()
        .map_err(|_| ParseError::new(position, format!("row `{digits}` is out of range")))?;
    if row_one_based == 0 {
        return Err(ParseError::new(
            position,
            "row number must be at least 1".to_string(),
        ));
    }
    Ok(row_one_based - 1)
}

#[cfg(test)]
mod tests {
    use super::*;
    use gridyard_core::cell_id;

    #[test]
    fn parses_common_a1_refs() {
        let cases: &[(&str, u32, u32)] = &[
            ("A1", 0, 0),
            ("B2", 1, 1),
            ("Z1", 0, 25),
            ("AA1", 0, 26),
            ("AB10", 9, 27),
            ("a1", 0, 0),
        ];

        for &(text, row, col) in cases {
            assert_eq!(
                parse_a1(text, 0).expect(text),
                (row, col),
                "parse_a1({text})"
            );
            // Sanity: coordinates pack into the core CellId scheme.
            let _ = cell_id(row, col);
        }
    }

    #[test]
    fn rejects_malformed_a1() {
        let cases: &[&str] = &["", "1A", "A", "A0", "A-1", "A1B"];
        for &text in cases {
            assert!(parse_a1(text, 0).is_err(), "expected error for `{text}`");
        }
    }

    #[test]
    fn format_a1_round_trips_common_cases() {
        let cases: &[(u32, u32, &str)] = &[
            (0, 0, "A1"),
            (1, 1, "B2"),
            (0, 25, "Z1"),
            (0, 26, "AA1"),
            (9, 27, "AB10"),
        ];
        for &(row, col, expected) in cases {
            assert_eq!(format_a1(row, col), expected);
            assert_eq!(parse_a1(expected, 0).unwrap(), (row, col));
        }
    }
}
