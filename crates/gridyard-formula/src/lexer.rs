//! Tokenizes formula source into a flat token stream.

use crate::error::ParseError;

/// A single lexed token with its byte span in the source.
#[derive(Debug, Clone, PartialEq)]
pub struct Token {
    /// Token payload.
    pub kind: TokenKind,
    /// Inclusive start byte index.
    pub start: usize,
    /// Exclusive end byte index.
    pub end: usize,
}

/// Lexical token kinds for the v0.1 arithmetic grammar.
#[derive(Debug, Clone, PartialEq)]
pub enum TokenKind {
    /// Floating-point or integer literal.
    Number(f64),
    /// Double-quoted string literal (quotes stripped, escapes applied).
    String(String),
    /// Identifier (cell refs, bools, function names).
    Ident(String),
    /// `+`
    Plus,
    /// `-`
    Minus,
    /// `*`
    Star,
    /// `/`
    Slash,
    /// `(`
    LParen,
    /// `)`
    RParen,
    /// `,` (argument separator)
    Comma,
    /// `:` (range separator)
    Colon,
    /// End of input.
    Eof,
}

/// Lexes `source` into tokens. Leading `=` (after whitespace) is skipped
/// so both `=A1+1` and `A1+1` are accepted.
pub fn lex(source: &str) -> Result<Vec<Token>, ParseError> {
    let bytes = source.as_bytes();
    let mut i = skip_ws(bytes, 0);
    if i < bytes.len() && bytes[i] == b'=' {
        i = skip_ws(bytes, i + 1);
    }

    let mut tokens = Vec::new();
    while i < bytes.len() {
        let start = i;
        let b = bytes[i];
        let kind = match b {
            b'+' => {
                i += 1;
                TokenKind::Plus
            }
            b'-' => {
                i += 1;
                TokenKind::Minus
            }
            b'*' => {
                i += 1;
                TokenKind::Star
            }
            b'/' => {
                i += 1;
                TokenKind::Slash
            }
            b'(' => {
                i += 1;
                TokenKind::LParen
            }
            b')' => {
                i += 1;
                TokenKind::RParen
            }
            b',' => {
                i += 1;
                TokenKind::Comma
            }
            b':' => {
                i += 1;
                TokenKind::Colon
            }
            b'"' => {
                let (s, next) = lex_string(source, i)?;
                i = next;
                TokenKind::String(s)
            }
            b'0'..=b'9' | b'.' => {
                let (n, next) = lex_number(source, i)?;
                i = next;
                TokenKind::Number(n)
            }
            b'A'..=b'Z' | b'a'..=b'z' => {
                let (ident, next) = lex_ident(source, i);
                i = next;
                TokenKind::Ident(ident)
            }
            _ if b.is_ascii_whitespace() => {
                i = skip_ws(bytes, i);
                continue;
            }
            _ => {
                return Err(ParseError::new(
                    start,
                    format!("unexpected character `{}`", b.escape_ascii()),
                ));
            }
        };
        tokens.push(Token {
            kind,
            start,
            end: i,
        });
        i = skip_ws(bytes, i);
    }

    tokens.push(Token {
        kind: TokenKind::Eof,
        start: source.len(),
        end: source.len(),
    });
    Ok(tokens)
}

fn skip_ws(bytes: &[u8], mut i: usize) -> usize {
    while i < bytes.len() && bytes[i].is_ascii_whitespace() {
        i += 1;
    }
    i
}

fn lex_number(source: &str, start: usize) -> Result<(f64, usize), ParseError> {
    let bytes = source.as_bytes();
    let mut i = start;
    let mut saw_digit = false;
    let mut saw_dot = false;

    while i < bytes.len() {
        match bytes[i] {
            b'0'..=b'9' => {
                saw_digit = true;
                i += 1;
            }
            b'.' if !saw_dot => {
                saw_dot = true;
                i += 1;
            }
            _ => break,
        }
    }

    if !saw_digit {
        return Err(ParseError::new(start, "expected a number"));
    }

    let text = &source[start..i];
    let value: f64 = text
        .parse()
        .map_err(|_| ParseError::new(start, format!("invalid number `{text}`")))?;
    Ok((value, i))
}

fn lex_ident(source: &str, start: usize) -> (String, usize) {
    let bytes = source.as_bytes();
    let mut i = start;
    while i < bytes.len() && bytes[i].is_ascii_alphanumeric() {
        i += 1;
    }
    (source[start..i].to_string(), i)
}

fn lex_string(source: &str, start: usize) -> Result<(String, usize), ParseError> {
    let bytes = source.as_bytes();
    debug_assert_eq!(bytes[start], b'"');
    let mut i = start + 1;
    let mut out = String::new();
    while i < bytes.len() {
        match bytes[i] {
            b'"' => return Ok((out, i + 1)),
            b'\\' => {
                i += 1;
                if i >= bytes.len() {
                    return Err(ParseError::new(start, "unterminated string literal"));
                }
                match bytes[i] {
                    b'"' => out.push('"'),
                    b'\\' => out.push('\\'),
                    b'n' => out.push('\n'),
                    b't' => out.push('\t'),
                    other => {
                        return Err(ParseError::new(
                            i,
                            format!("invalid string escape `\\{}`", other.escape_ascii()),
                        ));
                    }
                }
                i += 1;
            }
            b => {
                out.push(b as char);
                i += 1;
            }
        }
    }
    Err(ParseError::new(start, "unterminated string literal"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lexes_arithmetic_and_refs() {
        let tokens = lex("=A1 + 2.5*(B2:B4)").expect("lex");
        let kinds: Vec<&TokenKind> = tokens.iter().map(|t| &t.kind).collect();
        assert!(matches!(kinds[0], TokenKind::Ident(s) if s == "A1"));
        assert!(matches!(kinds[1], TokenKind::Plus));
        assert!(matches!(kinds[2], TokenKind::Number(n) if (*n - 2.5).abs() < f64::EPSILON));
        assert!(matches!(kinds[3], TokenKind::Star));
        assert!(matches!(kinds[4], TokenKind::LParen));
        assert!(matches!(kinds[5], TokenKind::Ident(s) if s == "B2"));
        assert!(matches!(kinds[6], TokenKind::Colon));
        assert!(matches!(kinds[7], TokenKind::Ident(s) if s == "B4"));
        assert!(matches!(kinds[8], TokenKind::RParen));
        assert!(matches!(kinds[9], TokenKind::Eof));
    }

    #[test]
    fn lexes_strings_commas_and_calls() {
        let tokens = lex(r#"SUM(1, "a")"#).expect("lex");
        assert!(matches!(tokens[0].kind, TokenKind::Ident(ref s) if s == "SUM"));
        assert!(matches!(tokens[1].kind, TokenKind::LParen));
        assert!(matches!(tokens[2].kind, TokenKind::Number(n) if (n - 1.0).abs() < f64::EPSILON));
        assert!(matches!(tokens[3].kind, TokenKind::Comma));
        assert!(matches!(tokens[4].kind, TokenKind::String(ref s) if s == "a"));
        assert!(matches!(tokens[5].kind, TokenKind::RParen));
    }

    #[test]
    fn rejects_unknown_characters_with_position() {
        let err = lex("1 & 2").expect_err("expected error");
        assert_eq!(err.position, 2);
        assert!(err.message.contains("unexpected character"));
    }
}
