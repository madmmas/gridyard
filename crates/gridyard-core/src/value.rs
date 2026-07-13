//! Cell values and spreadsheet error kinds.
//!
//! See `docs/01-grid-engine-core-spec.md` (Internal data model).

/// Spreadsheet error kinds, roughly matching Excel/`#ERROR!` semantics.
///
/// Formula evaluation (later crates) produces these; the core only stores
/// them as [`Value::Error`] payloads.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ErrorKind {
    /// `#DIV/0!` — division by zero.
    Div0,
    /// `#VALUE!` — wrong type of argument or operand.
    Value,
    /// `#REF!` — invalid cell reference.
    Ref,
    /// `#NAME?` — unrecognized function or name.
    Name,
    /// `#NUM!` — invalid numeric value.
    Num,
    /// `#N/A` — value not available.
    Na,
    /// `#NULL!` — null intersection of ranges.
    Null,
    /// Circular reference among formulas.
    Circular,
}

/// A computed or literal cell value.
///
/// Dates from the full engine spec are deferred; v0.1 stores them as
/// [`Value::Number`] (serial day) or [`Value::Text`] until a dedicated
/// variant is needed.
#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    /// IEEE-754 number (including integers stored as `f64`).
    Number(f64),
    /// UTF-8 text.
    Text(String),
    /// Boolean.
    Bool(bool),
    /// One-dimensional list (UNIQUE / FILTER / SORT results, etc.).
    Array(Vec<Value>),
    /// No value — used for missing/cleared cells; not stored in the sparse map.
    Empty,
    /// Evaluation or type error.
    Error(ErrorKind),
}

impl Value {
    /// Returns `true` when this is [`Value::Empty`].
    pub fn is_empty(&self) -> bool {
        matches!(self, Value::Empty)
    }

    /// Coerce to a number the way spreadsheet arithmetic typically does:
    /// - [`Value::Number`] as-is
    /// - [`Value::Bool`]: `true` → `1.0`, `false` → `0.0`
    /// - [`Value::Empty`] → `0.0`
    /// - [`Value::Text`]: parse as `f64` when the whole string is numeric
    /// - [`Value::Error`] / [`Value::Array`]: no coercion
    pub fn coerce_number(&self) -> Option<f64> {
        match self {
            Value::Number(n) => Some(*n),
            Value::Bool(b) => Some(if *b { 1.0 } else { 0.0 }),
            Value::Empty => Some(0.0),
            Value::Text(s) => {
                let trimmed = s.trim();
                if trimmed.is_empty() {
                    Some(0.0)
                } else {
                    trimmed.parse().ok()
                }
            }
            Value::Error(_) | Value::Array(_) => None,
        }
    }

    /// Coerce to a boolean the way spreadsheet logic typically does:
    /// - [`Value::Bool`] as-is
    /// - [`Value::Number`]: non-zero → `true`
    /// - [`Value::Empty`] → `false`
    /// - [`Value::Text`]: non-empty → `true`
    /// - [`Value::Error`] / [`Value::Array`]: no coercion
    pub fn coerce_bool(&self) -> Option<bool> {
        match self {
            Value::Bool(b) => Some(*b),
            Value::Number(n) => Some(*n != 0.0),
            Value::Empty => Some(false),
            Value::Text(s) => Some(!s.is_empty()),
            Value::Error(_) | Value::Array(_) => None,
        }
    }

    /// Coerce to display text for concatenation and text functions.
    ///
    /// Errors and arrays cannot be coerced.
    pub fn coerce_text(&self) -> Option<String> {
        match self {
            Value::Number(n) => Some(format_number_text(*n)),
            Value::Text(s) => Some(s.clone()),
            Value::Bool(true) => Some("TRUE".to_string()),
            Value::Bool(false) => Some("FALSE".to_string()),
            Value::Empty => Some(String::new()),
            Value::Error(_) | Value::Array(_) => None,
        }
    }
}

fn format_number_text(n: f64) -> String {
    if n.fract() == 0.0 && n.abs() < 1e15 {
        format!("{}", n as i64)
    } else {
        format!("{n}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn value_equality_cases() {
        let cases: &[(Value, Value, bool)] = &[
            (Value::Empty, Value::Empty, true),
            (Value::Number(1.0), Value::Number(1.0), true),
            (Value::Number(1.0), Value::Number(2.0), false),
            (Value::Text("a".into()), Value::Text("a".into()), true),
            (Value::Text("a".into()), Value::Text("b".into()), false),
            (Value::Bool(true), Value::Bool(true), true),
            (Value::Bool(true), Value::Bool(false), false),
            (
                Value::Error(ErrorKind::Name),
                Value::Error(ErrorKind::Name),
                true,
            ),
            (
                Value::Error(ErrorKind::Name),
                Value::Error(ErrorKind::Div0),
                false,
            ),
            (Value::Empty, Value::Number(0.0), false),
            (Value::Number(1.0), Value::Bool(true), false),
            (Value::Text("1".into()), Value::Number(1.0), false),
        ];

        for (left, right, expected) in cases {
            assert_eq!(
                left == right,
                *expected,
                "equality: {left:?} == {right:?} expected {expected}"
            );
        }
    }

    #[test]
    fn coerce_number_cases() {
        let cases: &[(Value, Option<f64>)] = &[
            (Value::Number(42.5), Some(42.5)),
            (Value::Bool(true), Some(1.0)),
            (Value::Bool(false), Some(0.0)),
            (Value::Empty, Some(0.0)),
            (Value::Text("2.5".into()), Some(2.5)),
            (Value::Text("  -2  ".into()), Some(-2.0)),
            (Value::Text("".into()), Some(0.0)),
            (Value::Text("   ".into()), Some(0.0)),
            (Value::Text("abc".into()), None),
            (Value::Text("1abc".into()), None),
            (Value::Error(ErrorKind::Value), None),
            (Value::Error(ErrorKind::Div0), None),
            (Value::Array(vec![Value::Number(1.0)]), None),
        ];

        for (value, expected) in cases {
            assert_eq!(value.coerce_number(), *expected, "coerce_number({value:?})");
        }
    }

    #[test]
    fn coerce_text_cases() {
        let cases: &[(Value, Option<&str>)] = &[
            (Value::Number(3.0), Some("3")),
            (Value::Text("hi".into()), Some("hi")),
            (Value::Bool(true), Some("TRUE")),
            (Value::Bool(false), Some("FALSE")),
            (Value::Empty, Some("")),
            (Value::Error(ErrorKind::Name), None),
            (Value::Array(vec![]), None),
        ];

        for (value, expected) in cases {
            assert_eq!(
                value.coerce_text().as_deref(),
                *expected,
                "coerce_text({value:?})"
            );
        }
    }

    #[test]
    fn coerce_bool_cases() {
        let cases: &[(Value, Option<bool>)] = &[
            (Value::Bool(true), Some(true)),
            (Value::Bool(false), Some(false)),
            (Value::Number(0.0), Some(false)),
            (Value::Number(1.0), Some(true)),
            (Value::Number(-3.0), Some(true)),
            (Value::Empty, Some(false)),
            (Value::Text("".into()), Some(false)),
            (Value::Text("x".into()), Some(true)),
            (Value::Error(ErrorKind::Na), None),
            (Value::Error(ErrorKind::Circular), None),
            (Value::Array(vec![Value::Bool(true)]), None),
        ];

        for (value, expected) in cases {
            assert_eq!(value.coerce_bool(), *expected, "coerce_bool({value:?})");
        }
    }

    #[test]
    fn is_empty_only_for_empty_variant() {
        assert!(Value::Empty.is_empty());
        assert!(!Value::Number(0.0).is_empty());
        assert!(!Value::Text(String::new()).is_empty());
        assert!(!Value::Bool(false).is_empty());
        assert!(!Value::Error(ErrorKind::Null).is_empty());
        assert!(!Value::Array(vec![]).is_empty());
    }
}
