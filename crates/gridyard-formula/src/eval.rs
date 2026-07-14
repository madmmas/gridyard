//! Formula evaluation against an arena AST.

use gridyard_core::{ErrorKind, Value};

use crate::ast::{Ast, BinOp, Expr, NodeId, UnaryOp};
use crate::functions::{self, EvalEnv};
use crate::refs::expand_range;

/// Evaluates a parsed formula using default env (real `NOW`/`RAND`).
///
/// Bare cell refs and ranges yield [`ErrorKind::Ref`] without a sheet
/// resolver. Cross-region refs also yield [`ErrorKind::Ref`].
pub fn evaluate(ast: &Ast) -> Value {
    evaluate_with(ast, &EvalEnv::default())
}

/// Evaluates a parsed formula with an explicit [`EvalEnv`] (injectable
/// `NOW`/`RAND` for tests). Cell refs resolve to [`ErrorKind::Ref`].
pub fn evaluate_with(ast: &Ast, env: &EvalEnv) -> Value {
    evaluate_with_cells(ast, env, |_| Value::Error(ErrorKind::Ref))
}

/// Evaluates a formula, resolving same-region cell refs/ranges through
/// `get_cell`. Cross-region refs resolve to [`ErrorKind::Ref`].
pub fn evaluate_with_cells<F>(ast: &Ast, env: &EvalEnv, get_cell: F) -> Value
where
    F: Fn(gridyard_core::CellId) -> Value,
{
    evaluate_with_resolvers(ast, env, get_cell, |_, _| Value::Error(ErrorKind::Ref))
}

/// Evaluates a formula with separate same-region and cross-region resolvers.
pub fn evaluate_with_resolvers<F, G>(
    ast: &Ast,
    env: &EvalEnv,
    get_cell: F,
    get_external: G,
) -> Value
where
    F: Fn(gridyard_core::CellId) -> Value,
    G: Fn(&str, gridyard_core::CellId) -> Value,
{
    eval_node(ast, ast.root(), env, &get_cell, &get_external)
}

fn eval_node<F, G>(ast: &Ast, id: NodeId, env: &EvalEnv, get_cell: &F, get_external: &G) -> Value
where
    F: Fn(gridyard_core::CellId) -> Value,
    G: Fn(&str, gridyard_core::CellId) -> Value,
{
    match ast.node(id) {
        Expr::Number(n) => Value::Number(*n),
        Expr::Text(s) => Value::Text(s.clone()),
        Expr::Bool(b) => Value::Bool(*b),
        Expr::CellRef(cell) => get_cell(*cell),
        Expr::Range { start, end } => {
            let values: Vec<Value> = expand_range(*start, *end)
                .into_iter()
                .map(get_cell)
                .collect();
            Value::Array(values)
        }
        Expr::ExternalCellRef { region, cell } => get_external(region, *cell),
        Expr::ExternalRange { region, start, end } => {
            let values: Vec<Value> = expand_range(*start, *end)
                .into_iter()
                .map(|c| get_external(region, c))
                .collect();
            Value::Array(values)
        }
        Expr::Unary { op, expr } => eval_unary(ast, *op, *expr, env, get_cell, get_external),
        Expr::Binary { op, left, right } => {
            eval_binary(ast, *op, *left, *right, env, get_cell, get_external)
        }
        Expr::Call { name, args } => {
            if name.eq_ignore_ascii_case("IF") {
                return eval_if(ast, args, env, get_cell, get_external);
            }
            let values: Vec<Value> = args
                .iter()
                .map(|a| eval_node(ast, *a, env, get_cell, get_external))
                .collect();
            functions::dispatch(name, &values, env)
        }
    }
}

fn eval_if<F, G>(ast: &Ast, args: &[NodeId], env: &EvalEnv, get_cell: &F, get_external: &G) -> Value
where
    F: Fn(gridyard_core::CellId) -> Value,
    G: Fn(&str, gridyard_core::CellId) -> Value,
{
    if args.len() < 2 || args.len() > 3 {
        return Value::Error(ErrorKind::Value);
    }
    match eval_node(ast, args[0], env, get_cell, get_external) {
        Value::Error(e) => Value::Error(e),
        cond => match cond.coerce_bool() {
            Some(true) => eval_node(ast, args[1], env, get_cell, get_external),
            Some(false) => args
                .get(2)
                .map(|id| eval_node(ast, *id, env, get_cell, get_external))
                .unwrap_or(Value::Bool(false)),
            None => Value::Error(ErrorKind::Value),
        },
    }
}

fn eval_unary<F, G>(
    ast: &Ast,
    op: UnaryOp,
    expr: NodeId,
    env: &EvalEnv,
    get_cell: &F,
    get_external: &G,
) -> Value
where
    F: Fn(gridyard_core::CellId) -> Value,
    G: Fn(&str, gridyard_core::CellId) -> Value,
{
    let v = eval_node(ast, expr, env, get_cell, get_external);
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

fn eval_binary<F, G>(
    ast: &Ast,
    op: BinOp,
    left: NodeId,
    right: NodeId,
    env: &EvalEnv,
    get_cell: &F,
    get_external: &G,
) -> Value
where
    F: Fn(gridyard_core::CellId) -> Value,
    G: Fn(&str, gridyard_core::CellId) -> Value,
{
    let l = eval_node(ast, left, env, get_cell, get_external);
    if let Value::Error(e) = l {
        return Value::Error(e);
    }
    let r = eval_node(ast, right, env, get_cell, get_external);
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
    use gridyard_core::cell_id;

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
        assert_eq!(
            eval_formula("A1:A8").unwrap(),
            Value::Array(vec![Value::Error(ErrorKind::Ref); 8])
        );
        assert_eq!(
            eval_formula("main!A1").unwrap(),
            Value::Error(ErrorKind::Ref)
        );
    }

    #[test]
    fn resolves_cells_through_callback() {
        let ast = crate::parse_formula("A1*2").unwrap();
        let value = evaluate_with_cells(&ast, &EvalEnv::default(), |id| {
            if id == cell_id(0, 0) {
                Value::Number(21.0)
            } else {
                Value::Error(ErrorKind::Ref)
            }
        });
        assert_eq!(value, Value::Number(42.0));
    }

    #[test]
    fn resolves_external_refs_through_callback() {
        let ast = crate::parse_formula("main!A1+1").unwrap();
        let value = evaluate_with_resolvers(
            &ast,
            &EvalEnv::default(),
            |_| Value::Error(ErrorKind::Ref),
            |region, id| {
                if region.eq_ignore_ascii_case("main") && id == cell_id(0, 0) {
                    Value::Number(10.0)
                } else {
                    Value::Error(ErrorKind::Ref)
                }
            },
        );
        assert_eq!(value, Value::Number(11.0));
    }
}
