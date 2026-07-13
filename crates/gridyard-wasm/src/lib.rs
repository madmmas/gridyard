//! The WASM boundary for Gridyard — the only crate that touches
//! `wasm-bindgen`/`web-sys`. See `docs/01-grid-engine-core-spec.md`
//! (section 9, the WASM ↔ JS boundary) in the earlier draft spec, and
//! `docs/03-workspace-schema-spec.md` for what the runtime calls into.
//!
//! No implementation yet — this crate is scaffolding for milestone M0/M1.

#[cfg(test)]
mod tests {
    // Placeholder — replace once this crate has real code. See
    // crates/gridyard-core/src/lib.rs (`cell_id`) for the pattern this
    // repo follows: colocated `#[cfg(test)] mod tests`, one test per
    // behavior, edge cases included. See .cursor/rules/010-rust.mdc.
    #[test]
    fn placeholder() {
        assert!(
            true,
            "replace with a real test once this crate has real code"
        );
    }
}
