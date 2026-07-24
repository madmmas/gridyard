# Manual testing log — issue #<N>

> **Purpose:** Record results from walking [`docs/MANUAL_TESTING.md`](../MANUAL_TESTING.md).
> Not for feature design notes, CI-only triage, or other non-manual runs.
>
> **How to use:** Copy to `issue-<N>.md`, fill metadata and issue-specific notes,
> mark each check ✅ / ❌ / ⏭ / ⏳, then delete this usage block from the copy.
> Drop or mark ⏭ any section the tracking issue scopes out.

Working log for
[#<N>](https://github.com/madmmas/gridyard/issues/<N>)
(`<short title — e.g. verify shipped behavior against MANUAL_TESTING.md>`).

Guide: [`docs/MANUAL_TESTING.md`](../MANUAL_TESTING.md) (update date if the guide moved).

| Field | Value |
|-------|-------|
| Issue | [#<N>](https://github.com/madmmas/gridyard/issues/<N>) |
| Tester | |
| Date | YYYY-MM-DD |
| Branch | `<branch-name>` |
| Environment | local — `make mock-server` + `make demo` → `http://localhost:5173` |
| Overall | ⏳ in progress |

**Result legend:** ✅ pass · ❌ fail · ⏭ skip · ⏳ pending

**Issue notes (do not treat as failures for this pass):**
- …
- On failure: open a bug with steps/expected/actual and link it from #<N>
  (do not silently skip).

---

## Setup

| Check | Result | Notes / bug link |
|-------|--------|------------------|
| `make mock-server` starts cleanly | ⏳ | |
| `make demo` starts cleanly | ⏳ | |
| Status line loads loan rows from mock server (not a fetch error) | ⏳ | |

---

## A. Demo layout (main + bottom only)

| # | Result | Notes / bug link |
|---|--------|------------------|
| A1 Load demo — toolbar + main + bottom only; no form panel | ⏳ | |
| A2 No `#form-panel`, `#form-body`, or “form · selected row” chrome | ⏳ | |
| A3 Hint mentions mock server / 5k / Find / permissions / Notes — not form mirroring | ⏳ | |

**Section A:** ⏳

---

## B. Workspace switcher

| # | Result | Notes / bug link |
|---|--------|------------------|
| B1 Loan Review — `main · loans`; sample borrowers | ⏳ | |
| B2 Employee Management — `main · employees`; no full reload | ⏳ | |
| B3 Switch back to Loan Review — loans return; Aggregate tracks main | ⏳ | |

**Section B:** ⏳

---

## C. Main grid — selection, formula bar, editing

| # | Result | Notes / bug link |
|---|--------|------------------|
| C1 Click cell — selection + formula-bar address/value | ⏳ | |
| C2 Arrow keys — selection moves; status updates | ⏳ | |
| C3 Formula-bar edit + Enter — commit + dependents | ⏳ | |
| C4 Bad formula (e.g. `=1/`) — soft-fail error styling | ⏳ | |
| C5 Escape while editing — cancels draft | ⏳ | |
| C6 Double-click — formula bar focuses; caret at end | ⏳ | |
| C7 Type-over into formula bar (#25) | ⏳ | |
| C8 F2 opens formula bar with existing input | ⏳ | |
| C9 Tab / Enter after commit advances selection | ⏳ | |

**Section C:** ⏳

---

## D. Undo / redo

| # | Result | Notes / bug link |
|---|--------|------------------|
| D1 Cmd/Ctrl+Z restores previous value | ⏳ | |
| D2 Cmd/Ctrl+Shift+Z (redo) reapplies edit | ⏳ | |
| D3 Undo with nothing left — no crash | ⏳ | |

**Section D:** ⏳

---

## E. Bottom region — Aggregate

| # | Result | Notes / bug link |
|---|--------|------------------|
| E1 Aggregate tab on load; headers match main | ⏳ | |
| E2 Edit bottom cell via its formula bar | ⏳ | |
| E3 Cross-region formula (e.g. `=main!A1`) updates with main | ⏳ | |
| E4 **+** on Aggregate adds a row | ⏳ | |

**Section E:** ⏳

---

## F. Bottom region — Notes

| # | Result | Notes / bug link |
|---|--------|------------------|
| F1 Notes tab — Aggregate hidden; Notes table shown | ⏳ | |
| F2 Edit Notes value — no formula evaluation | ⏳ | |
| F3 **+** on Notes adds a row | ⏳ | |
| F4 Switch back to Aggregate — prior state intact | ⏳ | |

**Section F:** ⏳

---

## G. Permissions (demo user switcher)

Loan Review, then repeat G1–G4 on Employee Management.

| # | Result | Notes / bug link |
|---|--------|------------------|
| G1 Switch demo user — status + column hide/remap | ⏳ | |
| G2 Hidden field — column absent from main (and Aggregate) | ⏳ | |
| G3 View-only — formula bar read-only; status denial | ⏳ | |
| G4 Edit permission — formula-bar edits commit | ⏳ | |
| G5 Denied bottom region — `#bottom-panel` hidden | ⏳ | |
| G6 Full-access user — columns + bottom return | ⏳ | |
| G1–G4 on Employee Management | ⏳ | |

**Section G:** ⏳

---

## H. Layout permissions — column resize

| # | Result | Notes / bug link |
|---|--------|------------------|
| H1 Allowed user — header edge cursor `col-resize` | ⏳ | |
| H2 Drag — width updates; Aggregate stays synced | ⏳ | |
| H3 Without resize permission — denied; widths unchanged | ⏳ | |
| H4 Reset shared widths (admin-capable) — defaults restored | ⏳ | |
| H5 Reset without modify-shared-layout — denied | ⏳ | |

**Section H:** ⏳

---

## I. Virtualization + 5k rows + rAF paint

I1–I3 typically required; I4–I6 as practical (or per tracking issue).

| # | Result | Notes / bug link |
|---|--------|------------------|
| I1 Enable 5k rows — ~5000 rows; tall scroll spacer | ⏳ | |
| I2 Rapid scroll — viewport paint; stays responsive | ⏳ | |
| I3 Row ~2500 overdue — `=B1` / computed without prior paint | ⏳ | |
| I4 (optional) DevTools — one paint per region per frame | ⏳ | |
| I5 Disable 5k — small mock loan set returns | ⏳ | |
| I6 5k on Employee Management — no-op / Loan-only | ⏳ | |

**Section I:** ⏳

---

## J. Search (Find)

| # | Result | Notes / bug link |
|---|--------|------------------|
| J1 Substring match — `N of M`; highlights | ⏳ | |
| J2 Next / Prev — active match + scroll into view | ⏳ | |
| J3 No hits — status shows no matches | ⏳ | |
| J4 Clear / Escape — chrome + highlights gone | ⏳ | |
| J5 5k + rare token — scroll-into-view obvious | ⏳ | |

**Section J:** ⏳

---

## K. Form engine removal (regression)

| # | Result | Notes / bug link |
|---|--------|------------------|
| K1 Select different main rows — no form panel; main + bottom only | ⏳ | |
| K2 Edit main cell — grid + Aggregate update; no form sync | ⏳ | |
| K3 No `buildFormView` / `form.ts` / public form types on runtime | ⏳ | |

**Section K:** ⏳

---

## L. Automated tests (guide section L)

Covered by the manual guide’s “no demo chrome yet” table — run locally or rely on CI.

```bash
make test
# or: cargo test --workspace && npm test --workspaces --if-present
```

| Feature / command | Result | Notes / bug link |
|-------------------|--------|------------------|
| `cargo test -p gridyard-core` | ⏳ | |
| `cargo test -p gridyard-formula` | ⏳ | |
| `cargo test -p gridyard-graph` | ⏳ | |
| `cargo test -p gridyard-wasm` | ⏳ | |
| `cargo test -p gridyard-grid` | ⏳ | |
| `cargo test -p gridyard-io` | ⏳ | |
| `npm test -w @gridyard/grid-renderer` | ⏳ | |
| `npm test -w @gridyard/workspace-runtime` | ⏳ | |
| `npm test -w web-demo` | ⏳ | |
| Full `make test` (or CI) green | ⏳ | |

**Section L:** ⏳

---

## M. Smoke checklist

| Check | Result | Notes / bug link |
|-------|--------|------------------|
| `make mock-server` + `make demo` start cleanly | ⏳ | |
| A Demo layout (A1–A3) | ⏳ | |
| B Workspace switch (B1–B3) | ⏳ | |
| C Edit path (C1–C9) | ⏳ | |
| D Undo/redo (D1–D2+) | ⏳ | |
| E Aggregate + F Notes | ⏳ | |
| G Permissions (G1–G6) | ⏳ | |
| H Resize / reset (H1–H5) | ⏳ | |
| I 5k scroll + off-screen formula (I1–I3) | ⏳ | |
| J Find (J1–J5) | ⏳ | |
| K Form removal (K1–K3) | ⏳ | |
| `make test` (or CI) green | ⏳ | |

**Section M:** ⏳

---

## Failures filed

| Bug issue | Related check(s) | Status |
|-----------|------------------|--------|
| — | — | — |

---

## Sign-off

- [ ] All in-scope browser sections A–K pass (or failures filed and linked)
- [ ] Section L / `make test` green
- [ ] Section M smoke checklist complete
- [ ] Close [#<N>](https://github.com/madmmas/gridyard/issues/<N>)

---

## Naming (this folder)

| Kind | Pattern | Example |
|------|---------|---------|
| Template | `TEMPLATE.md` | this file |
| Per-issue manual testing log | `issue-<N>.md` | `issue-85.md` |

One log file per manual-testing pass / tracking issue. The checklist lives in
`docs/MANUAL_TESTING.md`; this folder only stores completed (or in-progress)
result logs.
