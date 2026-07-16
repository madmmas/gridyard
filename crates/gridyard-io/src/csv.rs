//! CSV import and export (RFC 4180–style).
//!
//! Export writes **computed** cell values, never formula text. Import builds
//! literal cells from field strings (no formula inference). See
//! `docs/01-grid-engine-core-spec.md` (Import / Export).

use gridyard_core::{cell_id, Cell, ErrorKind, SparseGrid, Value};

/// Error while parsing CSV text.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CsvError {
    message: String,
}

impl CsvError {
    fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }

    /// Human-readable description.
    pub fn message(&self) -> &str {
        &self.message
    }
}

impl std::fmt::Display for CsvError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.message)
    }
}

impl std::error::Error for CsvError {}

/// Rectangular table of literal field strings produced by [`import_csv`].
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct CsvTable {
    rows: Vec<Vec<String>>,
}

impl CsvTable {
    /// Empty table (0×0).
    pub fn new() -> Self {
        Self::default()
    }

    /// Builds from an explicit row-major matrix.
    pub fn from_rows(rows: Vec<Vec<String>>) -> Self {
        Self { rows }
    }

    /// Number of records (rows).
    pub fn row_count(&self) -> usize {
        self.rows.len()
    }

    /// Width of the widest row (0 if empty).
    pub fn col_count(&self) -> usize {
        self.rows.iter().map(Vec::len).max().unwrap_or(0)
    }

    /// All rows (may be jagged; shorter rows imply trailing empty cells).
    pub fn rows(&self) -> &[Vec<String>] {
        &self.rows
    }

    /// Field at `(row, col)`, or `""` if out of range / missing.
    pub fn get(&self, row: usize, col: usize) -> &str {
        self.rows
            .get(row)
            .and_then(|r| r.get(col))
            .map(String::as_str)
            .unwrap_or("")
    }

    /// Stores each field as a literal text cell in a new [`SparseGrid`].
    ///
    /// Empty fields are omitted (sparse empty). Formula-looking text such as
    /// `=A1` is stored as plain text input, not evaluated.
    pub fn to_sparse_grid(&self) -> SparseGrid {
        let mut grid = SparseGrid::new();
        for (r, row) in self.rows.iter().enumerate() {
            for (c, field) in row.iter().enumerate() {
                if field.is_empty() {
                    continue;
                }
                let id = cell_id(r as u32, c as u32);
                grid.set_cell(id, Cell::new(field.clone(), Value::Text(field.clone())));
            }
        }
        grid
    }
}

/// Source of computed values for [`export_csv`].
pub trait CsvValueSource {
    /// Computed value at `(row, col)`; missing cells should return [`Value::Empty`].
    fn get_value(&self, row: u32, col: u32) -> Value;
}

/// Serializes a `rows`×`cols` region of computed values to CSV text.
///
/// Formula cells contribute their computed [`Value`], not raw `=…` input.
pub fn export_csv(source: &impl CsvValueSource, rows: u32, cols: u32) -> String {
    let mut out = String::new();
    for r in 0..rows {
        if r > 0 {
            out.push('\n');
        }
        for c in 0..cols {
            if c > 0 {
                out.push(',');
            }
            let field = value_to_field(&source.get_value(r, c));
            write_field(&mut out, &field);
        }
    }
    out
}

/// Parses CSV text into a [`CsvTable`] of literal fields.
///
/// Supports quoted fields with embedded commas, newlines, and `""` escapes.
pub fn import_csv(text: &str) -> Result<CsvTable, CsvError> {
    let mut rows: Vec<Vec<String>> = Vec::new();
    let mut row: Vec<String> = Vec::new();
    let mut field = String::new();
    let mut chars = text.chars().peekable();
    let mut in_quotes = false;
    let mut saw_any = false;

    while let Some(ch) = chars.next() {
        saw_any = true;
        if in_quotes {
            match ch {
                '"' => {
                    if chars.peek() == Some(&'"') {
                        chars.next();
                        field.push('"');
                    } else {
                        in_quotes = false;
                    }
                }
                _ => field.push(ch),
            }
            continue;
        }

        match ch {
            '"' => {
                if !field.is_empty() {
                    return Err(CsvError::new(
                        "unexpected quote in unquoted field (RFC 4180)",
                    ));
                }
                in_quotes = true;
            }
            ',' => {
                row.push(std::mem::take(&mut field));
            }
            '\n' => {
                row.push(std::mem::take(&mut field));
                rows.push(std::mem::take(&mut row));
            }
            '\r' => {
                if chars.peek() == Some(&'\n') {
                    chars.next();
                }
                row.push(std::mem::take(&mut field));
                rows.push(std::mem::take(&mut row));
            }
            _ => field.push(ch),
        }
    }

    if in_quotes {
        return Err(CsvError::new("unterminated quoted field"));
    }

    if saw_any {
        // Trailing record without a final newline, or content after last newline.
        // If the input ended exactly on a record terminator, `row` and `field`
        // are empty — skip emitting an extra blank row.
        if !row.is_empty() || !field.is_empty() || rows.is_empty() {
            row.push(std::mem::take(&mut field));
            rows.push(row);
        }
    }

    Ok(CsvTable { rows })
}

/// Formats a [`CsvTable`] back to CSV text (round-trip helper).
pub fn write_csv(table: &CsvTable) -> String {
    let rows = table.row_count() as u32;
    if rows == 0 {
        return String::new();
    }
    let cols = (table.col_count() as u32).max(1);
    export_csv(&TableAsSource(table), rows, cols)
}

struct TableAsSource<'a>(&'a CsvTable);

impl CsvValueSource for TableAsSource<'_> {
    fn get_value(&self, row: u32, col: u32) -> Value {
        let s = self.0.get(row as usize, col as usize);
        if s.is_empty() {
            Value::Empty
        } else {
            Value::Text(s.to_string())
        }
    }
}

fn value_to_field(value: &Value) -> String {
    match value {
        Value::Empty => String::new(),
        Value::Number(n) => format_number(*n),
        Value::Text(s) => s.clone(),
        Value::Bool(true) => "TRUE".to_string(),
        Value::Bool(false) => "FALSE".to_string(),
        Value::Error(kind) => error_display(*kind).to_string(),
        Value::Array(items) => items
            .iter()
            .map(value_to_field)
            .collect::<Vec<_>>()
            .join(","),
    }
}

fn format_number(n: f64) -> String {
    if n.fract() == 0.0 && n.abs() < 1e15 {
        format!("{}", n as i64)
    } else {
        format!("{n}")
    }
}

fn error_display(kind: ErrorKind) -> &'static str {
    match kind {
        ErrorKind::Div0 => "#DIV/0!",
        ErrorKind::Value => "#VALUE!",
        ErrorKind::Ref => "#REF!",
        ErrorKind::Name => "#NAME?",
        ErrorKind::Num => "#NUM!",
        ErrorKind::Na => "#N/A",
        ErrorKind::Null => "#NULL!",
        ErrorKind::Circular => "#CIRCULAR!",
    }
}

fn write_field(out: &mut String, field: &str) {
    if needs_quotes(field) {
        out.push('"');
        for ch in field.chars() {
            if ch == '"' {
                out.push('"');
                out.push('"');
            } else {
                out.push(ch);
            }
        }
        out.push('"');
    } else {
        out.push_str(field);
    }
}

fn needs_quotes(field: &str) -> bool {
    field.contains([',', '"', '\n', '\r'])
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[derive(Default)]
    struct MapSource {
        cells: HashMap<(u32, u32), Value>,
    }

    impl MapSource {
        fn set(&mut self, row: u32, col: u32, value: Value) {
            self.cells.insert((row, col), value);
        }
    }

    impl CsvValueSource for MapSource {
        fn get_value(&self, row: u32, col: u32) -> Value {
            self.cells.get(&(row, col)).cloned().unwrap_or(Value::Empty)
        }
    }

    #[test]
    fn export_uses_computed_values_not_formulas() {
        let mut src = MapSource::default();
        // Engine would store input "=A1+1" but computed value 11.
        src.set(0, 0, Value::Number(10.0));
        src.set(0, 1, Value::Number(11.0));

        let csv = export_csv(&src, 1, 2);
        assert_eq!(csv, "10,11");
        assert!(!csv.contains('='));
    }

    #[test]
    fn import_quoted_comma_and_newline() {
        let csv = "name,note\n\"Smith, Jane\",\"line1\nline2\"\n";
        let table = import_csv(csv).expect("parse");
        assert_eq!(table.row_count(), 2);
        assert_eq!(table.get(0, 0), "name");
        assert_eq!(table.get(0, 1), "note");
        assert_eq!(table.get(1, 0), "Smith, Jane");
        assert_eq!(table.get(1, 1), "line1\nline2");
    }

    #[test]
    fn import_escaped_quotes() {
        let table = import_csv("\"he said \"\"hi\"\"\"").expect("parse");
        assert_eq!(table.get(0, 0), "he said \"hi\"");
    }

    #[test]
    fn empty_cells_and_jagged_rows() {
        let table = import_csv("a,,c\n,d\n").expect("parse");
        assert_eq!(table.get(0, 0), "a");
        assert_eq!(table.get(0, 1), "");
        assert_eq!(table.get(0, 2), "c");
        assert_eq!(table.get(1, 0), "");
        assert_eq!(table.get(1, 1), "d");
        assert_eq!(table.col_count(), 3);
    }

    #[test]
    fn round_trip_export_import_literals() {
        let mut src = MapSource::default();
        src.set(0, 0, Value::Text("hello".into()));
        src.set(0, 1, Value::Number(42.0));
        src.set(1, 0, Value::Text("a,b".into()));
        src.set(1, 1, Value::Bool(true));
        src.set(2, 0, Value::Empty);
        src.set(2, 1, Value::Text("x\ny".into()));

        let csv = export_csv(&src, 3, 2);
        let table = import_csv(&csv).expect("import");
        assert_eq!(table.get(0, 0), "hello");
        assert_eq!(table.get(0, 1), "42");
        assert_eq!(table.get(1, 0), "a,b");
        assert_eq!(table.get(1, 1), "TRUE");
        assert_eq!(table.get(2, 0), "");
        assert_eq!(table.get(2, 1), "x\ny");

        // Re-export of imported literals matches original export.
        assert_eq!(write_csv(&table), csv);
    }

    #[test]
    fn formula_text_imported_as_literal_not_evaluated() {
        let table = import_csv("=A1+1,10").expect("parse");
        let grid = table.to_sparse_grid();
        let cell = grid.get_cell(cell_id(0, 0)).expect("cell");
        assert_eq!(cell.input, "=A1+1");
        assert_eq!(cell.value, Value::Text("=A1+1".into()));
    }

    #[test]
    fn unterminated_quote_is_error() {
        let err = import_csv("\"oops").expect_err("should fail");
        assert!(err.message().contains("unterminated"));
    }

    #[test]
    fn table_driven_parse_cases() {
        let cases: &[(&str, &[&[&str]])] = &[
            ("", &[]),
            ("a", &[&["a"]]),
            ("a,b", &[&["a", "b"]]),
            ("a\nb", &[&["a"], &["b"]]),
            ("a\r\nb", &[&["a"], &["b"]]),
            ("\"\"", &[&[""]]),
            (",", &[&["", ""]]),
            ("1,2\n3,4", &[&["1", "2"], &["3", "4"]]),
        ];

        for &(input, expected) in cases {
            let table = import_csv(input)
                .unwrap_or_else(|e| panic!("parse failed for {input:?}: {}", e.message()));
            assert_eq!(table.row_count(), expected.len(), "rows for {input:?}");
            for (r, exp_row) in expected.iter().enumerate() {
                let got: Vec<&str> = table.rows()[r].iter().map(String::as_str).collect();
                assert_eq!(&got[..], *exp_row, "row {r} for {input:?}");
            }
        }
    }

    #[test]
    fn sparse_grid_skips_empty_fields() {
        let table = import_csv("a,,c").expect("parse");
        let grid = table.to_sparse_grid();
        assert!(grid.get_cell(cell_id(0, 0)).is_some());
        assert!(grid.get_cell(cell_id(0, 1)).is_none());
        assert!(grid.get_cell(cell_id(0, 2)).is_some());
        assert_eq!(grid.len(), 2);
    }
}
