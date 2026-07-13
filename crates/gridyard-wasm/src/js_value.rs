//! Convert [`Value`] to a plain JSON-shaped [`JsValue`] for JS callers.

use gridyard_core::{ErrorKind, Value};
use js_sys::{Array, Object, Reflect};
use wasm_bindgen::JsValue;

/// Serializes a cell value as `{ type, value? }` / `{ type, kind }` for errors.
pub fn value_to_js(value: &Value) -> Result<JsValue, JsValue> {
    match value {
        Value::Number(n) => typed("number", JsValue::from_f64(*n)),
        Value::Text(s) => typed("text", JsValue::from_str(s)),
        Value::Bool(b) => typed("bool", JsValue::from_bool(*b)),
        Value::Empty => {
            let obj = Object::new();
            Reflect::set(&obj, &"type".into(), &"empty".into())?;
            Ok(obj.into())
        }
        Value::Error(kind) => {
            let obj = Object::new();
            Reflect::set(&obj, &"type".into(), &"error".into())?;
            Reflect::set(
                &obj,
                &"kind".into(),
                &JsValue::from_str(error_kind_name(*kind)),
            )?;
            Ok(obj.into())
        }
        Value::Array(items) => {
            let arr = Array::new();
            for item in items {
                arr.push(&value_to_js(item)?);
            }
            typed("array", arr.into())
        }
    }
}

fn typed(type_name: &str, value: JsValue) -> Result<JsValue, JsValue> {
    let obj = Object::new();
    Reflect::set(&obj, &"type".into(), &JsValue::from_str(type_name))?;
    Reflect::set(&obj, &"value".into(), &value)?;
    Ok(obj.into())
}

fn error_kind_name(kind: ErrorKind) -> &'static str {
    match kind {
        ErrorKind::Div0 => "Div0",
        ErrorKind::Value => "Value",
        ErrorKind::Ref => "Ref",
        ErrorKind::Name => "Name",
        ErrorKind::Num => "Num",
        ErrorKind::Na => "Na",
        ErrorKind::Null => "Null",
        ErrorKind::Circular => "Circular",
    }
}
