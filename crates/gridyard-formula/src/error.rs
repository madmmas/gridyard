//! Position-aware formula parse errors.

use std::fmt;

/// A parse failure with a byte offset into the source formula.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParseError {
    /// Human-readable description of what went wrong.
    pub message: String,
    /// Byte index in the input where the error was detected.
    pub position: usize,
}

impl ParseError {
    /// Builds a [`ParseError`] at `position` with `message`.
    pub fn new(position: usize, message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            position,
        }
    }
}

impl fmt::Display for ParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "parse error at position {}: {}",
            self.position, self.message
        )
    }
}

impl std::error::Error for ParseError {}
