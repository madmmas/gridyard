//! v0.1 spreadsheet function registry and implementations.
//!
//! Spec list (`docs/01-grid-engine-core-spec.md`): SUM, COUNT, AVERAGE, IF,
//! AND, OR, VLOOKUP, XLOOKUP, MATCH, INDEX, TEXT, LEFT, RIGHT, LEN, CONCAT,
//! DATE, NOW, RAND, UNIQUE, FILTER, SORT.
//!
//! Lookup / array helpers accept flattened literal argument lists so they
//! can be tested without a live grid (issue #3 acceptance).

use std::cmp::Ordering;
use std::time::{SystemTime, UNIX_EPOCH};

use gridyard_core::{ErrorKind, Value};

/// Injectable evaluation environment (clock / RNG for deterministic tests).
#[derive(Debug, Clone, Default)]
pub struct EvalEnv {
    /// When set, `NOW()` returns this Excel-style serial instead of wall clock.
    pub now_serial: Option<f64>,
    /// When set, `RAND()` returns this value instead of a fresh random.
    pub rand_value: Option<f64>,
}

/// Dispatches a function call by name (case-insensitive).
pub fn dispatch(name: &str, args: &[Value], env: &EvalEnv) -> Value {
    match name.to_ascii_uppercase().as_str() {
        "SUM" => fn_sum(args),
        "COUNT" => fn_count(args),
        "AVERAGE" => fn_average(args),
        "IF" => fn_if(args),
        "AND" => fn_and(args),
        "OR" => fn_or(args),
        "VLOOKUP" => fn_vlookup(args),
        "XLOOKUP" => fn_xlookup(args),
        "MATCH" => fn_match(args),
        "INDEX" => fn_index(args),
        "TEXT" => fn_text(args),
        "LEFT" => fn_left(args),
        "RIGHT" => fn_right(args),
        "LEN" => fn_len(args),
        "CONCAT" => fn_concat(args),
        "DATE" => fn_date(args),
        "NOW" => fn_now(args, env),
        "RAND" => fn_rand(args, env),
        "UNIQUE" => fn_unique(args),
        "FILTER" => fn_filter(args),
        "SORT" => fn_sort(args),
        _ => Value::Error(ErrorKind::Name),
    }
}

fn first_error(args: &[Value]) -> Option<ErrorKind> {
    args.iter().find_map(|v| match v {
        Value::Error(e) => Some(*e),
        _ => None,
    })
}

fn flatten(args: &[Value]) -> Vec<&Value> {
    let mut out = Vec::new();
    for a in args {
        match a {
            Value::Array(items) => {
                for item in items {
                    out.push(item);
                }
            }
            other => out.push(other),
        }
    }
    out
}

fn require_arity(args: &[Value], min: usize, max: usize) -> Result<(), Value> {
    if args.len() < min || args.len() > max {
        Err(Value::Error(ErrorKind::Value))
    } else {
        Ok(())
    }
}

fn values_equal(a: &Value, b: &Value) -> bool {
    match (a, b) {
        (Value::Number(x), Value::Number(y)) => x == y,
        (Value::Text(x), Value::Text(y)) => x == y,
        (Value::Bool(x), Value::Bool(y)) => x == y,
        (Value::Empty, Value::Empty) => true,
        (Value::Number(x), Value::Bool(y)) | (Value::Bool(y), Value::Number(x)) => {
            *x == if *y { 1.0 } else { 0.0 }
        }
        _ => a == b,
    }
}

fn fn_sum(args: &[Value]) -> Value {
    if let Some(e) = first_error(args) {
        return Value::Error(e);
    }
    let mut total = 0.0;
    for v in flatten(args) {
        match v.coerce_number() {
            Some(n) => total += n,
            None => return Value::Error(ErrorKind::Value),
        }
    }
    Value::Number(total)
}

fn fn_count(args: &[Value]) -> Value {
    if let Some(e) = first_error(args) {
        return Value::Error(e);
    }
    // Excel COUNT: count numbers (and numeric text); skip bool/blank/non-numeric text.
    let mut count = 0.0;
    for v in flatten(args) {
        match v {
            Value::Number(_) => count += 1.0,
            Value::Text(s) if s.trim().parse::<f64>().is_ok() => count += 1.0,
            _ => {}
        }
    }
    Value::Number(count)
}

fn fn_average(args: &[Value]) -> Value {
    if let Some(e) = first_error(args) {
        return Value::Error(e);
    }
    let flat = flatten(args);
    if flat.is_empty() {
        return Value::Error(ErrorKind::Div0);
    }
    let mut total = 0.0;
    let mut n = 0.0;
    for v in flat {
        match v {
            Value::Number(x) => {
                total += *x;
                n += 1.0;
            }
            Value::Text(s) => {
                if let Ok(x) = s.trim().parse::<f64>() {
                    total += x;
                    n += 1.0;
                }
            }
            Value::Bool(_) | Value::Empty | Value::Array(_) | Value::Error(_) => {}
        }
    }
    if n == 0.0 {
        Value::Error(ErrorKind::Div0)
    } else {
        Value::Number(total / n)
    }
}

fn fn_if(args: &[Value]) -> Value {
    if let Err(e) = require_arity(args, 2, 3) {
        return e;
    }
    match &args[0] {
        Value::Error(e) => Value::Error(*e),
        cond => match cond.coerce_bool() {
            Some(true) => args[1].clone(),
            Some(false) => args.get(2).cloned().unwrap_or(Value::Bool(false)),
            None => Value::Error(ErrorKind::Value),
        },
    }
}

fn fn_and(args: &[Value]) -> Value {
    if args.is_empty() {
        return Value::Error(ErrorKind::Value);
    }
    if let Some(e) = first_error(args) {
        return Value::Error(e);
    }
    for v in flatten(args) {
        match v.coerce_bool() {
            Some(true) => {}
            Some(false) => return Value::Bool(false),
            None => return Value::Error(ErrorKind::Value),
        }
    }
    Value::Bool(true)
}

fn fn_or(args: &[Value]) -> Value {
    if args.is_empty() {
        return Value::Error(ErrorKind::Value);
    }
    if let Some(e) = first_error(args) {
        return Value::Error(e);
    }
    for v in flatten(args) {
        match v.coerce_bool() {
            Some(true) => return Value::Bool(true),
            Some(false) => {}
            None => return Value::Error(ErrorKind::Value),
        }
    }
    Value::Bool(false)
}

/// `VLOOKUP(needle, key1, val1, key2, val2, …)` — flattened key/value pairs.
fn fn_vlookup(args: &[Value]) -> Value {
    if args.len() < 3 || args.len().is_multiple_of(2) {
        return Value::Error(ErrorKind::Value);
    }
    if let Some(e) = first_error(args) {
        return Value::Error(e);
    }
    let needle = &args[0];
    let mut i = 1;
    while i + 1 < args.len() {
        if values_equal(&args[i], needle) {
            return args[i + 1].clone();
        }
        i += 2;
    }
    Value::Error(ErrorKind::Na)
}

/// `XLOOKUP(needle, k1..kn, r1..rn)` with equal-sized key and return lists.
/// Argument layout: needle, then n keys, then n returns (`1 + 2n` args, n≥1).
fn fn_xlookup(args: &[Value]) -> Value {
    if args.len() < 3 || !(args.len() - 1).is_multiple_of(2) {
        return Value::Error(ErrorKind::Value);
    }
    if let Some(e) = first_error(args) {
        return Value::Error(e);
    }
    let n = (args.len() - 1) / 2;
    let needle = &args[0];
    let keys = &args[1..=n];
    let rets = &args[n + 1..];
    for (i, key) in keys.iter().enumerate() {
        if values_equal(key, needle) {
            return rets[i].clone();
        }
    }
    Value::Error(ErrorKind::Na)
}

/// `MATCH(needle, v1, v2, …)` → 1-based index of the first equal value.
fn fn_match(args: &[Value]) -> Value {
    if args.len() < 2 {
        return Value::Error(ErrorKind::Value);
    }
    if let Some(e) = first_error(args) {
        return Value::Error(e);
    }
    let needle = &args[0];
    for (i, v) in args[1..].iter().enumerate() {
        if values_equal(v, needle) {
            return Value::Number((i + 1) as f64);
        }
    }
    Value::Error(ErrorKind::Na)
}

/// `INDEX(v1, v2, …, i)` — last arg is a 1-based index into the preceding values.
fn fn_index(args: &[Value]) -> Value {
    if args.len() < 2 {
        return Value::Error(ErrorKind::Value);
    }
    if let Some(e) = first_error(args) {
        return Value::Error(e);
    }
    let (index_val, items) = args.split_last().expect("len >= 2");
    let Some(idx) = index_val.coerce_number() else {
        return Value::Error(ErrorKind::Value);
    };
    if idx.fract() != 0.0 || idx < 1.0 {
        return Value::Error(ErrorKind::Num);
    }
    let i = idx as usize;
    if i == 0 || i > items.len() {
        return Value::Error(ErrorKind::Ref);
    }
    items[i - 1].clone()
}

fn fn_text(args: &[Value]) -> Value {
    // TEXT(value) or TEXT(value, format) — format is accepted but ignored in v0.1.
    if let Err(e) = require_arity(args, 1, 2) {
        return e;
    }
    if let Some(e) = first_error(args) {
        return Value::Error(e);
    }
    match args[0].coerce_text() {
        Some(s) => Value::Text(s),
        None => Value::Error(ErrorKind::Value),
    }
}

fn fn_left(args: &[Value]) -> Value {
    if let Err(e) = require_arity(args, 1, 2) {
        return e;
    }
    if let Some(e) = first_error(args) {
        return Value::Error(e);
    }
    let Some(text) = args[0].coerce_text() else {
        return Value::Error(ErrorKind::Value);
    };
    let n = if args.len() == 1 {
        1.0
    } else {
        match args[1].coerce_number() {
            Some(n) if n.fract() == 0.0 && n >= 0.0 => n,
            _ => return Value::Error(ErrorKind::Value),
        }
    };
    let take = (n as usize).min(text.chars().count());
    Value::Text(text.chars().take(take).collect())
}

fn fn_right(args: &[Value]) -> Value {
    if let Err(e) = require_arity(args, 1, 2) {
        return e;
    }
    if let Some(e) = first_error(args) {
        return Value::Error(e);
    }
    let Some(text) = args[0].coerce_text() else {
        return Value::Error(ErrorKind::Value);
    };
    let n = if args.len() == 1 {
        1.0
    } else {
        match args[1].coerce_number() {
            Some(n) if n.fract() == 0.0 && n >= 0.0 => n,
            _ => return Value::Error(ErrorKind::Value),
        }
    };
    let chars: Vec<char> = text.chars().collect();
    let take = (n as usize).min(chars.len());
    Value::Text(chars[chars.len() - take..].iter().collect())
}

fn fn_len(args: &[Value]) -> Value {
    if let Err(e) = require_arity(args, 1, 1) {
        return e;
    }
    if let Some(e) = first_error(args) {
        return Value::Error(e);
    }
    match args[0].coerce_text() {
        Some(s) => Value::Number(s.chars().count() as f64),
        None => Value::Error(ErrorKind::Value),
    }
}

fn fn_concat(args: &[Value]) -> Value {
    if let Some(e) = first_error(args) {
        return Value::Error(e);
    }
    let mut out = String::new();
    for v in flatten(args) {
        match v.coerce_text() {
            Some(s) => out.push_str(&s),
            None => return Value::Error(ErrorKind::Value),
        }
    }
    Value::Text(out)
}

fn fn_date(args: &[Value]) -> Value {
    if let Err(e) = require_arity(args, 3, 3) {
        return e;
    }
    if let Some(e) = first_error(args) {
        return Value::Error(e);
    }
    let (Some(y), Some(m), Some(d)) = (
        args[0].coerce_number(),
        args[1].coerce_number(),
        args[2].coerce_number(),
    ) else {
        return Value::Error(ErrorKind::Value);
    };
    if y.fract() != 0.0 || m.fract() != 0.0 || d.fract() != 0.0 {
        return Value::Error(ErrorKind::Num);
    }
    match excel_serial(y as i32, m as i32, d as i32) {
        Some(serial) => Value::Number(serial),
        None => Value::Error(ErrorKind::Num),
    }
}

fn fn_now(args: &[Value], env: &EvalEnv) -> Value {
    if let Err(e) = require_arity(args, 0, 0) {
        return e;
    }
    if let Some(n) = env.now_serial {
        return Value::Number(n);
    }
    Value::Number(system_now_serial())
}

fn fn_rand(args: &[Value], env: &EvalEnv) -> Value {
    if let Err(e) = require_arity(args, 0, 0) {
        return e;
    }
    if let Some(n) = env.rand_value {
        return Value::Number(n);
    }
    Value::Number(system_rand())
}

fn fn_unique(args: &[Value]) -> Value {
    if let Some(e) = first_error(args) {
        return Value::Error(e);
    }
    let mut out = Vec::new();
    for v in flatten(args) {
        if !out.iter().any(|u| values_equal(u, v)) {
            out.push(v.clone());
        }
    }
    Value::Array(out)
}

/// `FILTER(v1, c1, v2, c2, …)` — keep values whose paired condition is true.
fn fn_filter(args: &[Value]) -> Value {
    if args.is_empty() || !args.len().is_multiple_of(2) {
        return Value::Error(ErrorKind::Value);
    }
    if let Some(e) = first_error(args) {
        return Value::Error(e);
    }
    let mut out = Vec::new();
    let mut i = 0;
    while i < args.len() {
        match args[i + 1].coerce_bool() {
            Some(true) => out.push(args[i].clone()),
            Some(false) => {}
            None => return Value::Error(ErrorKind::Value),
        }
        i += 2;
    }
    Value::Array(out)
}

fn fn_sort(args: &[Value]) -> Value {
    if let Some(e) = first_error(args) {
        return Value::Error(e);
    }
    let mut items: Vec<Value> = flatten(args).into_iter().cloned().collect();
    items.sort_by(compare_sort_keys);
    Value::Array(items)
}

fn compare_sort_keys(a: &Value, b: &Value) -> Ordering {
    match (a.coerce_number(), b.coerce_number()) {
        (Some(x), Some(y)) => x.partial_cmp(&y).unwrap_or(Ordering::Equal),
        (Some(_), None) => Ordering::Less,
        (None, Some(_)) => Ordering::Greater,
        (None, None) => match (a.coerce_text(), b.coerce_text()) {
            (Some(x), Some(y)) => x.cmp(&y),
            _ => Ordering::Equal,
        },
    }
}

/// Excel serial date (days since 1899-12-30), without the Lotus 1900 leap bug.
fn excel_serial(year: i32, month: i32, day: i32) -> Option<f64> {
    if !(1..=12).contains(&month) || day < 1 || day > days_in_month(year, month)? {
        return None;
    }
    let mut y = year;
    let mut m = month;
    if m <= 2 {
        y -= 1;
        m += 12;
    }
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = (y - era * 400) as u32;
    let doy = (153 * (m as u32 - 3) + 2) / 5 + day as u32 - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let unix_days = (era * 146_097 + doe as i32 - 719_468) as i64;
    // Excel epoch 1899-12-30 is Unix day -22091?
    // 1970-01-01 serial in Excel (no leap bug) ≈ 25569.
    let serial = unix_days as f64 + 25569.0;
    Some(serial)
}

fn days_in_month(year: i32, month: i32) -> Option<i32> {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => Some(31),
        4 | 6 | 9 | 11 => Some(30),
        2 => Some(if is_leap(year) { 29 } else { 28 }),
        _ => None,
    }
}

fn is_leap(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

fn system_now_serial() -> f64 {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs_f64())
        .unwrap_or(0.0);
    secs / 86_400.0 + 25569.0
}

fn system_rand() -> f64 {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    f64::from(nanos % 10_000) / 10_000.0
}

#[cfg(test)]
mod sum_tests {
    use super::*;
    use crate::eval::eval_formula;

    #[test]
    fn table() {
        let cases: &[(&str, Value)] = &[
            ("SUM(1,2,3)", Value::Number(6.0)),
            ("SUM()", Value::Number(0.0)),
            ("SUM(1,TRUE)", Value::Number(2.0)),
            ("SUM(1,\"x\")", Value::Error(ErrorKind::Value)),
        ];
        for &(src, ref expected) in cases {
            assert_eq!(eval_formula(src).unwrap(), *expected, "{src}");
        }
    }
}

#[cfg(test)]
mod count_tests {
    use super::*;
    use crate::eval::eval_formula;

    #[test]
    fn table() {
        let cases: &[(&str, Value)] = &[
            ("COUNT(1,2,\"x\",3)", Value::Number(3.0)),
            ("COUNT(\"2\",\"a\")", Value::Number(1.0)),
            ("COUNT()", Value::Number(0.0)),
        ];
        for &(src, ref expected) in cases {
            assert_eq!(eval_formula(src).unwrap(), *expected, "{src}");
        }
    }
}

#[cfg(test)]
mod average_tests {
    use super::*;
    use crate::eval::eval_formula;

    #[test]
    fn table() {
        let cases: &[(&str, Value)] = &[
            ("AVERAGE(2,4,6)", Value::Number(4.0)),
            ("AVERAGE()", Value::Error(ErrorKind::Div0)),
            ("AVERAGE(\"x\")", Value::Error(ErrorKind::Div0)),
        ];
        for &(src, ref expected) in cases {
            assert_eq!(eval_formula(src).unwrap(), *expected, "{src}");
        }
    }
}

#[cfg(test)]
mod if_tests {
    use super::*;
    use crate::eval::eval_formula;

    #[test]
    fn table() {
        let cases: &[(&str, Value)] = &[
            ("IF(TRUE,1,2)", Value::Number(1.0)),
            ("IF(FALSE,1,2)", Value::Number(2.0)),
            ("IF(0,\"a\",\"b\")", Value::Text("b".into())),
            ("IF(1,9)", Value::Number(9.0)),
            ("IF()", Value::Error(ErrorKind::Value)),
            ("IF(1,2,3,4)", Value::Error(ErrorKind::Value)),
        ];
        for &(src, ref expected) in cases {
            assert_eq!(eval_formula(src).unwrap(), *expected, "{src}");
        }
    }
}

#[cfg(test)]
mod and_tests {
    use super::*;
    use crate::eval::eval_formula;

    #[test]
    fn table() {
        let cases: &[(&str, Value)] = &[
            ("AND(TRUE,TRUE)", Value::Bool(true)),
            ("AND(TRUE,FALSE)", Value::Bool(false)),
            ("AND(1,0)", Value::Bool(false)),
            ("AND()", Value::Error(ErrorKind::Value)),
        ];
        for &(src, ref expected) in cases {
            assert_eq!(eval_formula(src).unwrap(), *expected, "{src}");
        }
    }
}

#[cfg(test)]
mod or_tests {
    use super::*;
    use crate::eval::eval_formula;

    #[test]
    fn table() {
        let cases: &[(&str, Value)] = &[
            ("OR(FALSE,TRUE)", Value::Bool(true)),
            ("OR(FALSE,FALSE)", Value::Bool(false)),
            ("OR(0,0,1)", Value::Bool(true)),
            ("OR()", Value::Error(ErrorKind::Value)),
        ];
        for &(src, ref expected) in cases {
            assert_eq!(eval_formula(src).unwrap(), *expected, "{src}");
        }
    }
}

#[cfg(test)]
mod vlookup_tests {
    use super::*;
    use crate::eval::eval_formula;

    #[test]
    fn table() {
        let cases: &[(&str, Value)] = &[
            ("VLOOKUP(2,1,10,2,20,3,30)", Value::Number(20.0)),
            ("VLOOKUP(9,1,10,2,20)", Value::Error(ErrorKind::Na)),
            ("VLOOKUP(1,1)", Value::Error(ErrorKind::Value)),
        ];
        for &(src, ref expected) in cases {
            assert_eq!(eval_formula(src).unwrap(), *expected, "{src}");
        }
    }
}

#[cfg(test)]
mod xlookup_tests {
    use super::*;
    use crate::eval::eval_formula;

    #[test]
    fn table() {
        let cases: &[(&str, Value)] = &[
            ("XLOOKUP(2,1,2,3,10,20,30)", Value::Number(20.0)),
            ("XLOOKUP(9,1,2,10,20)", Value::Error(ErrorKind::Na)),
            ("XLOOKUP(1)", Value::Error(ErrorKind::Value)),
        ];
        for &(src, ref expected) in cases {
            assert_eq!(eval_formula(src).unwrap(), *expected, "{src}");
        }
    }
}

#[cfg(test)]
mod match_tests {
    use super::*;
    use crate::eval::eval_formula;

    #[test]
    fn table() {
        let cases: &[(&str, Value)] = &[
            ("MATCH(20,10,20,30)", Value::Number(2.0)),
            ("MATCH(9,10,20)", Value::Error(ErrorKind::Na)),
            ("MATCH(1)", Value::Error(ErrorKind::Value)),
        ];
        for &(src, ref expected) in cases {
            assert_eq!(eval_formula(src).unwrap(), *expected, "{src}");
        }
    }
}

#[cfg(test)]
mod index_tests {
    use super::*;
    use crate::eval::eval_formula;

    #[test]
    fn table() {
        let cases: &[(&str, Value)] = &[
            ("INDEX(10,20,30,2)", Value::Number(20.0)),
            ("INDEX(10,20,0)", Value::Error(ErrorKind::Num)),
            ("INDEX(10,20,5)", Value::Error(ErrorKind::Ref)),
            ("INDEX(1)", Value::Error(ErrorKind::Value)),
        ];
        for &(src, ref expected) in cases {
            assert_eq!(eval_formula(src).unwrap(), *expected, "{src}");
        }
    }
}

#[cfg(test)]
mod text_tests {
    use super::*;
    use crate::eval::eval_formula;

    #[test]
    fn table() {
        let cases: &[(&str, Value)] = &[
            ("TEXT(3)", Value::Text("3".into())),
            ("TEXT(TRUE)", Value::Text("TRUE".into())),
            ("TEXT(1,\"0.00\")", Value::Text("1".into())),
            ("TEXT()", Value::Error(ErrorKind::Value)),
        ];
        for &(src, ref expected) in cases {
            assert_eq!(eval_formula(src).unwrap(), *expected, "{src}");
        }
    }
}

#[cfg(test)]
mod left_tests {
    use super::*;
    use crate::eval::eval_formula;

    #[test]
    fn table() {
        let cases: &[(&str, Value)] = &[
            ("LEFT(\"abc\")", Value::Text("a".into())),
            ("LEFT(\"abc\",2)", Value::Text("ab".into())),
            ("LEFT(\"abc\",0)", Value::Text("".into())),
            ("LEFT(\"abc\",-1)", Value::Error(ErrorKind::Value)),
        ];
        for &(src, ref expected) in cases {
            assert_eq!(eval_formula(src).unwrap(), *expected, "{src}");
        }
    }
}

#[cfg(test)]
mod right_tests {
    use super::*;
    use crate::eval::eval_formula;

    #[test]
    fn table() {
        let cases: &[(&str, Value)] = &[
            ("RIGHT(\"abc\")", Value::Text("c".into())),
            ("RIGHT(\"abc\",2)", Value::Text("bc".into())),
            ("RIGHT(\"abc\",5)", Value::Text("abc".into())),
        ];
        for &(src, ref expected) in cases {
            assert_eq!(eval_formula(src).unwrap(), *expected, "{src}");
        }
    }
}

#[cfg(test)]
mod len_tests {
    use super::*;
    use crate::eval::eval_formula;

    #[test]
    fn table() {
        let cases: &[(&str, Value)] = &[
            ("LEN(\"abc\")", Value::Number(3.0)),
            ("LEN(\"\")", Value::Number(0.0)),
            ("LEN(12)", Value::Number(2.0)),
            ("LEN()", Value::Error(ErrorKind::Value)),
        ];
        for &(src, ref expected) in cases {
            assert_eq!(eval_formula(src).unwrap(), *expected, "{src}");
        }
    }
}

#[cfg(test)]
mod concat_tests {
    use super::*;
    use crate::eval::eval_formula;

    #[test]
    fn table() {
        let cases: &[(&str, Value)] = &[
            ("CONCAT(\"a\",\"b\",1)", Value::Text("ab1".into())),
            ("CONCAT()", Value::Text("".into())),
        ];
        for &(src, ref expected) in cases {
            assert_eq!(eval_formula(src).unwrap(), *expected, "{src}");
        }
    }
}

#[cfg(test)]
mod date_tests {
    use super::*;
    use crate::eval::eval_formula;

    #[test]
    fn table() {
        // 2020-01-01 → Excel serial 43831 (no 1900 leap bug).
        assert_eq!(
            eval_formula("DATE(2020,1,1)").unwrap(),
            Value::Number(43831.0)
        );
        assert_eq!(
            eval_formula("DATE(2020,13,1)").unwrap(),
            Value::Error(ErrorKind::Num)
        );
        assert_eq!(
            eval_formula("DATE(2020,1)").unwrap(),
            Value::Error(ErrorKind::Value)
        );
    }
}

#[cfg(test)]
mod now_tests {
    use super::*;
    use crate::eval::eval_formula_with;

    #[test]
    fn table() {
        let env = EvalEnv {
            now_serial: Some(45000.5),
            rand_value: None,
        };
        assert_eq!(
            eval_formula_with("NOW()", &env).unwrap(),
            Value::Number(45000.5)
        );
        assert_eq!(
            eval_formula_with("NOW(1)", &env).unwrap(),
            Value::Error(ErrorKind::Value)
        );
    }
}

#[cfg(test)]
mod rand_tests {
    use super::*;
    use crate::eval::eval_formula_with;

    #[test]
    fn table() {
        let env = EvalEnv {
            now_serial: None,
            rand_value: Some(0.25),
        };
        assert_eq!(
            eval_formula_with("RAND()", &env).unwrap(),
            Value::Number(0.25)
        );
        assert_eq!(
            eval_formula_with("RAND(1)", &env).unwrap(),
            Value::Error(ErrorKind::Value)
        );
    }
}

#[cfg(test)]
mod unique_tests {
    use super::*;
    use crate::eval::eval_formula;

    #[test]
    fn table() {
        assert_eq!(
            eval_formula("UNIQUE(1,2,2,3)").unwrap(),
            Value::Array(vec![
                Value::Number(1.0),
                Value::Number(2.0),
                Value::Number(3.0),
            ])
        );
        assert_eq!(eval_formula("UNIQUE()").unwrap(), Value::Array(vec![]));
    }
}

#[cfg(test)]
mod filter_tests {
    use super::*;
    use crate::eval::eval_formula;

    #[test]
    fn table() {
        assert_eq!(
            eval_formula("FILTER(10,TRUE,20,FALSE,30,TRUE)").unwrap(),
            Value::Array(vec![Value::Number(10.0), Value::Number(30.0)])
        );
        assert_eq!(
            eval_formula("FILTER(1,TRUE,2)").unwrap(),
            Value::Error(ErrorKind::Value)
        );
    }
}

#[cfg(test)]
mod sort_tests {
    use super::*;
    use crate::eval::eval_formula;

    #[test]
    fn table() {
        assert_eq!(
            eval_formula("SORT(3,1,2)").unwrap(),
            Value::Array(vec![
                Value::Number(1.0),
                Value::Number(2.0),
                Value::Number(3.0),
            ])
        );
    }
}

#[cfg(test)]
mod unknown_tests {
    use super::*;
    use crate::eval::eval_formula;

    #[test]
    fn unknown_name_is_name_error() {
        assert_eq!(
            eval_formula("NOPE(1)").unwrap(),
            Value::Error(ErrorKind::Name)
        );
    }
}
