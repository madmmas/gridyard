//! Formula lexer, parser, AST, evaluator, and function registry for
//! Gridyard. See `docs/01-grid-engine-core-spec.md`.
//!
//! This crate currently covers the first formula slice: lexing and
//! parsing arithmetic, cell references, and ranges into an arena-backed
//! AST. Evaluation and function calls arrive in later issues.

mod a1;
mod ast;
mod error;
mod lexer;
mod parser;

pub use ast::{Ast, BinOp, Expr, NodeId, UnaryOp};
pub use error::ParseError;
pub use parser::parse_formula;
