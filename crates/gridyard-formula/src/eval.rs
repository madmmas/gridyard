//! Formula evaluation against an arena AST.
//!
//! Cell references and ranges require a live sheet (later issues). This
//! slice evaluates literals, arithmetic, and the v0.1 function list.

use gridyard_core::{ErrorKind, Value};

use crate::ast::{Ast, BinOp, Expr, NodeId, UnaryOp};
use crate::functions::{self, EvalEnv};

/// Evaluates a parsed formula using default env (real `NOW`/`RAND`).
///
/// Bare cell refs and ranges yield [`ErrorKind::Ref`] until a sheet
/// context exists.
pub fn evaluate(ast: &Ast) -> Value {
    evaluate_with(ast, &EvalEnv::default())
}

/// Evaluates a parsed formula with an explicit [`EvalEnv`] (injectable
/// `NOW`/`RAND` for tests).
pub fn evaluate_with(ast: &Ast, env: &EvalEnv) -> Value {
    eval_node(ast, ast.root(), env)
}

fn eval_node(ast: &Ast, id: NodeId, env: &EvalEnv) -> Value {
    match ast.node(id) {
        Expr::Number(n) => Value::Number(*n),
        Expr::Text(s) => Value::Text(s.clone()),
        Expr::Bool(b) => Value::Bool(*b),
        Expr::CellRef(_) | Expr::Range { .. } => Value::Error(ErrorKind::Ref),
        Expr::Unary { op, expr } => eval_unary(ast, *op, *expr, env),
        Expr::Binary { op, left, right } => eval_binary(ast, *op, *left, *right, env),
        Expr::Call { name, args } => {
            if name.eq_ignore_ascii_case("IF") {
                return eval_if(ast, args, env);
            }
            let values: Vec<Value> = args.iter().map(|a| eval_node(ast, *a, env)).collect();
            functions::dispatch(name, &values, env)
        }
    }
}

fn eval_if(ast: &Ast, args: &[NodeId], env: &EvalEnv) -> Value {
    if args.len() < 2 || args.len() > 3 {
        return Value::Error(ErrorKind::Value);
    }
    match eval_node(ast, args[0], env) {
        Value::Error(e) => Value::Error(e),
        cond => match cond.coerce_bool() {
            Some(true) => eval_node(ast, args[1], env),
            Some(false) => args
                .get(2)
                .map(|id| eval_node(ast, *id, env))
                .unwrap_or(Value::Bool(false)),
            None => Value::Error(ErrorKind::Value),
        },
    }
}

fn eval_unary(ast: &Ast, op: UnaryOp, expr: NodeId, env: &EvalEnv) -> Value {
    let v = eval_node(ast, expr, env);
    if let Value::Error(e) = v {
        return Value::Error(e);
    }
    match v.coerce_number() {
        Some(n) => Value::Number(match op {
            UnaryOp::Pos => n,
            UnaryOp::Neg => -n,
        }),
        None => Value::Error(ErrorKind::Value),
    }
}

fn eval_binary(ast: &Ast, op: BinOp, left: NodeId, right: NodeId, env: &EvalEnv) -> Value {
    let l = eval_node(ast, left, env);
    if let Value::Error(e) = l {
        return Value::Error(e);
    }
    let r = eval_node(ast, right, env);
    if let Value::Error(e) = r {
        return Value::Error(e);
    }
    let (Some(ln), Some(rn)) = (l.coerce_number(), r.coerce_number()) else {
        return Value::Error(ErrorKind::Value);
    };
    match op {
        BinOp::Add => Value::Number(ln + rn),
        BinOp::Sub => Value::Number(ln - rn),
        BinOp::Mul => Value::Number(ln * rn),
        BinOp::Div => {
            if rn == 0.0 {
                Value::Error(ErrorKind::Div0)
            } else {
                Value::Number(ln / rn)
            }
        }
    }
}

/// Parse then evaluate a formula string (convenience for tests/callers).
pub fn eval_formula(source: &str) -> Result<Value, crate::ParseError> {
    Ok(evaluate(&crate::parse_formula(source)?))
}

/// Parse then evaluate with an explicit env.
pub fn eval_formula_with(source: &str, env: &EvalEnv) -> Result<Value, crate::ParseError> {
    Ok(evaluate_with(&crate::parse_formula(source)?, env))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn evaluates_arithmetic_literals() {
        let cases: &[(&str, Value)] = &[
            ("1+2*3", Value::Number(7.0)),
            ("(1+2)*3", Value::Number(9.0)),
            ("8/4", Value::Number(2.0)),
            ("1/0", Value::Error(ErrorKind::Div0)),
            ("-5+2", Value::Number(-3.0)),
        ];
        for &(src, ref expected) in cases {
            assert_eq!(eval_formula(src).unwrap(), *expected, "src={src}");
        }
    }

    #[test]
    fn cell_refs_without_sheet_are_ref_errors() {
        assert_eq!(eval_formula("A1").unwrap(), Value::Error(ErrorKind::Ref));
        assert_eq!(eval_formula("A1:A8").unwrap(), Value::Error(ErrorKind::Ref));
    }
}
