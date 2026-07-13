//! Recursive-descent parser with standard arithmetic precedence.
//!
//! Grammar (v0.1):
//! ```text
//! expr   = term (("+" | "-") term)*
//! term   = unary (("*" | "/") unary)*
//! unary  = ("+" | "-") unary | primary
//! primary = number | cell_ref | cell_ref ":" cell_ref | "(" expr ")"
//! ```

use gridyard_core::cell_id;
use slotmap::SlotMap;

use crate::a1::parse_a1;
use crate::ast::{Ast, BinOp, Expr, NodeId, UnaryOp};
use crate::error::ParseError;
use crate::lexer::{lex, Token, TokenKind};

/// Parses a formula string into an arena-backed [`Ast`].
///
/// Accepts an optional leading `=`. Does not evaluate the formula.
pub fn parse_formula(source: &str) -> Result<Ast, ParseError> {
    let tokens = lex(source)?;
    let mut parser = Parser {
        tokens: &tokens,
        index: 0,
        nodes: SlotMap::with_key(),
    };
    let root = parser.parse_expr()?;
    parser.expect_eof()?;
    Ok(Ast::from_parts(parser.nodes, root))
}

struct Parser<'a> {
    tokens: &'a [Token],
    index: usize,
    nodes: SlotMap<NodeId, Expr>,
}

impl<'a> Parser<'a> {
    fn peek(&self) -> &'a Token {
        &self.tokens[self.index]
    }

    fn bump(&mut self) -> &'a Token {
        let tok = &self.tokens[self.index];
        if !matches!(tok.kind, TokenKind::Eof) {
            self.index += 1;
        }
        tok
    }

    fn push(&mut self, expr: Expr) -> NodeId {
        self.nodes.insert(expr)
    }

    fn parse_expr(&mut self) -> Result<NodeId, ParseError> {
        let mut left = self.parse_term()?;
        loop {
            let op = match self.peek().kind {
                TokenKind::Plus => BinOp::Add,
                TokenKind::Minus => BinOp::Sub,
                _ => break,
            };
            self.bump();
            let right = self.parse_term()?;
            left = self.push(Expr::Binary { op, left, right });
        }
        Ok(left)
    }

    fn parse_term(&mut self) -> Result<NodeId, ParseError> {
        let mut left = self.parse_unary()?;
        loop {
            let op = match self.peek().kind {
                TokenKind::Star => BinOp::Mul,
                TokenKind::Slash => BinOp::Div,
                _ => break,
            };
            self.bump();
            let right = self.parse_unary()?;
            left = self.push(Expr::Binary { op, left, right });
        }
        Ok(left)
    }

    fn parse_unary(&mut self) -> Result<NodeId, ParseError> {
        match self.peek().kind {
            TokenKind::Plus => {
                self.bump();
                let expr = self.parse_unary()?;
                Ok(self.push(Expr::Unary {
                    op: UnaryOp::Pos,
                    expr,
                }))
            }
            TokenKind::Minus => {
                self.bump();
                let expr = self.parse_unary()?;
                Ok(self.push(Expr::Unary {
                    op: UnaryOp::Neg,
                    expr,
                }))
            }
            _ => self.parse_primary(),
        }
    }

    fn parse_primary(&mut self) -> Result<NodeId, ParseError> {
        let tok = self.peek();
        match &tok.kind {
            TokenKind::Number(n) => {
                let n = *n;
                self.bump();
                Ok(self.push(Expr::Number(n)))
            }
            TokenKind::Ident(name) => {
                let start_pos = tok.start;
                let name = name.clone();
                self.bump();
                let (row, col) = parse_a1(&name, start_pos)?;
                let start_id = cell_id(row, col);

                if matches!(self.peek().kind, TokenKind::Colon) {
                    self.bump();
                    let end_tok = self.peek();
                    match &end_tok.kind {
                        TokenKind::Ident(end_name) => {
                            let end_pos = end_tok.start;
                            let end_name = end_name.clone();
                            self.bump();
                            let (end_row, end_col) = parse_a1(&end_name, end_pos)?;
                            Ok(self.push(Expr::Range {
                                start: start_id,
                                end: cell_id(end_row, end_col),
                            }))
                        }
                        _ => Err(ParseError::new(
                            end_tok.start,
                            "expected cell reference after `:`",
                        )),
                    }
                } else {
                    Ok(self.push(Expr::CellRef(start_id)))
                }
            }
            TokenKind::LParen => {
                let open = self.bump().start;
                let inner = self.parse_expr()?;
                match self.peek().kind {
                    TokenKind::RParen => {
                        self.bump();
                        Ok(inner)
                    }
                    _ => Err(ParseError::new(open, "unclosed `(`")),
                }
            }
            TokenKind::Eof => Err(ParseError::new(tok.start, "unexpected end of formula")),
            _ => Err(ParseError::new(tok.start, "unexpected token in expression")),
        }
    }

    fn expect_eof(&self) -> Result<(), ParseError> {
        let tok = self.peek();
        if matches!(tok.kind, TokenKind::Eof) {
            Ok(())
        } else {
            Err(ParseError::new(
                tok.start,
                "unexpected tokens after expression",
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ast::Expr;

    #[test]
    fn precedence_and_parentheses() {
        let cases: &[(&str, &str)] = &[
            ("1+2*3", "(1+(2*3))"),
            ("(1+2)*3", "((1+2)*3)"),
            ("1-2-3", "((1-2)-3)"),
            ("8/4/2", "((8/4)/2)"),
            ("-1+2", "((-1)+2)"),
            ("-(1+2)", "(-(1+2))"),
            ("1+2*3-4/5", "((1+(2*3))-(4/5))"),
            ("  =  1 + 2  ", "(1+2)"),
        ];

        for &(src, expected) in cases {
            let ast = parse_formula(src).unwrap_or_else(|e| panic!("parse `{src}`: {e}"));
            assert_eq!(ast.parenthesized(), expected, "src={src}");
        }
    }

    #[test]
    fn cell_refs_and_ranges_are_distinct() {
        let single = parse_formula("A1").expect("A1");
        assert!(matches!(single.node(single.root()), Expr::CellRef(_)));

        let range = parse_formula("A1:A8").expect("A1:A8");
        match range.node(range.root()) {
            Expr::Range { start, end } => {
                assert_eq!(*start, cell_id(0, 0));
                assert_eq!(*end, cell_id(7, 0));
            }
            other => panic!("expected Range, got {other:?}"),
        }

        assert_ne!(single.parenthesized(), range.parenthesized());
    }

    #[test]
    fn arithmetic_with_refs() {
        let cases: &[(&str, &str)] = &[
            ("A1+B2", "(r0c0+r1c1)"),
            ("A1:A8*2", "(r0c0:r7c0*2)"),
            ("(A1+B1)/2", "((r0c0+r0c1)/2)"),
        ];
        for &(src, expected) in cases {
            let ast = parse_formula(src).unwrap_or_else(|e| panic!("parse `{src}`: {e}"));
            assert_eq!(ast.parenthesized(), expected, "src={src}");
        }
    }

    #[test]
    fn malformed_input_reports_position() {
        let cases: &[(&str, usize)] = &[
            ("", 0),
            ("1+", 2),
            ("(1+2", 0),
            ("1+*", 2),
            ("A1:", 3),
            ("1 2", 2),
            ("$$$", 0),
        ];

        for &(src, position) in cases {
            let err = parse_formula(src).expect_err(src);
            assert_eq!(err.position, position, "src=`{src}`, err={err}");
            assert!(!err.message.is_empty());
        }
    }
}
