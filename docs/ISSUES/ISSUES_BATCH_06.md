# Sixth issue batch — align the product with main + bottom grids only

**Batch status (2026-07-15):** Specs de-scoped in PR
[#73](https://github.com/madmmas/gridyard/pull/73); §31 code removal in
PR [#74](https://github.com/madmmas/gridyard/pull/74) /
[#72](https://github.com/madmmas/gridyard/issues/72).

| Batch § | GitHub | Title | PR |
|---------|--------|-------|----|
| 31 | [#72](https://github.com/madmmas/gridyard/issues/72) | Remove form engine from product scope | [#74](https://github.com/madmmas/gridyard/pull/74) |

Batch 05 closed the demo-wiring and remaining crate slices (§25–§30).
Direction change: **structured forms are out of product scope**. Specs
now state that Gridyard focuses on **main + bottom** grid regions
(Aggregate / Notes). This batch tracks deleting the form implementation
that Batch 04 §20 shipped, so code matches the updated docs.

---

## 31. [workspace-runtime / web-demo] Remove form engine from product scope

**Status:** done — PR [#74](https://github.com/madmmas/gridyard/pull/74) / issue [#72](https://github.com/madmmas/gridyard/issues/72)

### Spec reference
`docs/04-layout-and-permission-engine-spec.md` — Form engine (out of
scope); `docs/03-workspace-schema-spec.md`; `docs/06-mvp-scope-and-roadmap.md`.

### Context
Batch 04 §20 / [#49](https://github.com/madmmas/gridyard/issues/49) /
PR [#56](https://github.com/madmmas/gridyard/pull/56) added a form
engine and a demo form panel bound to the selected main row. Product
focus is now **main + bottom grids only**; forms must not drive further
work and should be removed from the runtime and demo.

### Scope
**In scope:**
- Remove form panel chrome from `apps/web-demo`
- Remove `@gridyard/workspace-runtime` form module and public exports
- Drop `form` from workspace fixtures / schema / parse validation
- Scrub remaining copy that presents the form panel as a live feature

**Out of scope:**
- Main / bottom grid behavior changes unrelated to deleting form glue
- Rebuilding forms later (would need a new spec revision)

### Acceptance criteria
- [x] Demo layout is main + bottom only (no form panel)
- [x] No form engine on the public workspace-runtime API
- [x] Fixtures/schema no longer require `form` for demo workspaces
- [x] Tests and typecheck pass

### Testing requirements
- [x] Vitest: form-specific tests removed or replaced; remaining suites green
- [x] Manual: web-demo shows only main/bottom; permission switching still works on grids
- [x] Manual checklist for shipped features: `docs/MANUAL_TESTING.md`

### Notes
Spec de-scope is a separate docs PR (#73); this issue is implementation cleanup.
