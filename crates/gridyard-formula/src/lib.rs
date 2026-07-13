//! Formula lexer, parser, AST, evaluator, and function registry for
//! Gridyard. See `docs/01-grid-engine-core-spec.md`.
//!
//! Covers lexing/parsing (arithmetic, refs, ranges, function calls) and
//! evaluating the v0.1 function list against literal inputs.

mod a1;
mod ast;
mod error;
mod eval;
mod functions;
mod lexer;
mod parser;

pub use ast::{Ast, BinOp, Expr, NodeId, UnaryOp};
pub use error::ParseError;
pub use eval::{eval_formula, eval_formula_with, evaluate, evaluate_with};
pub use functions::EvalEnv;
pub use parser::parse_formula;
