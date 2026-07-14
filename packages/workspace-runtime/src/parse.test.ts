import { describe, expect, it } from "vitest";

import { LOAN_REVIEW_WORKSPACE } from "./fixtures/loan-review.js";
import { parseWorkspaceDefinition } from "./parse.js";

describe("parseWorkspaceDefinition", () => {
  it("parses the loan-review workspace into a typed layout descriptor", () => {
    const result = parseWorkspaceDefinition(LOAN_REVIEW_WORKSPACE);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.layout.id).toBe("loan-review");
    expect(result.layout.name).toBe("Loan review");
    expect(result.layout.main.dataSource).toBe("loans");
    expect(result.layout.main.columns).toEqual([
      { fieldId: "borrower", name: "Borrower", type: "text", colIndex: 0 },
      { fieldId: "overdue", name: "Overdue", type: "currency", colIndex: 1 },
      { fieldId: "status", name: "Status", type: "status", colIndex: 2 },
      { fieldId: "daysLate", name: "Days late", type: "number", colIndex: 3 },
    ]);
    expect(result.layout.bottom.activeTab).toBe("aggregate");
    expect(result.layout.bottom.aggregate.columns).toEqual([
      {
        fieldId: "borrower",
        name: "Borrower",
        type: "text",
        colIndex: 0,
        syncedFromMain: true,
      },
      {
        fieldId: "overdue",
        name: "Overdue",
        type: "currency",
        colIndex: 1,
        syncedFromMain: true,
      },
      {
        fieldId: "status",
        name: "Status",
        type: "status",
        colIndex: 2,
        syncedFromMain: true,
      },
      {
        fieldId: "daysLate",
        name: "Days late",
        type: "number",
        colIndex: 3,
        syncedFromMain: true,
      },
    ]);
    expect(result.layout.bottom.notes.fields.map((f) => f.id)).toEqual([
      "notes",
      "docLink",
    ]);
    expect(result.layout.form?.sections.map((s) => s.title)).toEqual([
      "Customer Information",
      "Additional Information",
    ]);
    expect(result.layout.form?.sections[0]?.fields.map((c) => c.fieldId)).toEqual(
      ["borrower", "status"],
    );
  });

  it("rejects form fields that are not on main", () => {
    const input = structuredClone(LOAN_REVIEW_WORKSPACE);
    if (input.form?.sections[0] === undefined) {
      throw new Error("expected form section");
    }
    input.form.sections[0].fieldIds = ["borrower", "unknownField"];
    const result = parseWorkspaceDefinition(input);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors.some((e) => e.code === "unknown_form_field")).toBe(true);
  });

  it("defaults bottom.activeTab to aggregate when omitted", () => {
    const input = structuredClone(LOAN_REVIEW_WORKSPACE);
    delete input.regions.bottom.activeTab;
    const result = parseWorkspaceDefinition(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.layout.bottom.activeTab).toBe("aggregate");
    }
  });

  it("rejects a non-object root with a specific error", () => {
    const result = parseWorkspaceDefinition(null);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors).toEqual([
      {
        path: "",
        code: "not_object",
        message: "workspace definition must be a JSON object",
      },
    ]);
  });

  it("rejects a missing required top-level field", () => {
    const input = structuredClone(LOAN_REVIEW_WORKSPACE) as unknown as Record<
      string,
      unknown
    >;
    delete input["name"];
    const result = parseWorkspaceDefinition(input);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors.some((e) => e.path === "name" && e.code === "missing_string")).toBe(
      true,
    );
  });

  it("rejects an unknown region name", () => {
    const input = structuredClone(LOAN_REVIEW_WORKSPACE) as unknown as {
      regions: Record<string, unknown>;
    };
    input.regions["side"] = { id: "side" };
    const result = parseWorkspaceDefinition(input);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors).toContainEqual({
      path: "regions.side",
      code: "unknown_region",
      message: 'unknown region "side"; only "main" and "bottom" are allowed',
    });
  });

  it("rejects aggregate columns that omit syncedFromMain", () => {
    const input = structuredClone(LOAN_REVIEW_WORKSPACE);
    const first = input.regions.bottom.tabs.aggregate.columns[0] as {
      syncedFromMain?: boolean;
      fieldId: string;
    };
    delete first.syncedFromMain;
    const result = parseWorkspaceDefinition(input);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(
      result.errors.some(
        (e) =>
          e.path === "regions.bottom.tabs.aggregate.columns[0].syncedFromMain" &&
          e.code === "missing_sync_flag",
      ),
    ).toBe(true);
  });

  it("rejects aggregate sync when field order diverges from main", () => {
    const input = structuredClone(LOAN_REVIEW_WORKSPACE);
    const cols = input.regions.bottom.tabs.aggregate.columns;
    const a = cols[0];
    const b = cols[1];
    if (a === undefined || b === undefined) {
      throw new Error("fixture columns");
    }
    cols[0] = b;
    cols[1] = a;
    const result = parseWorkspaceDefinition(input);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(
      result.errors.some(
        (e) =>
          e.code === "sync_field_mismatch" &&
          e.path === "regions.bottom.tabs.aggregate.columns[0].fieldId",
      ),
    ).toBe(true);
  });

  it("rejects aggregate sync length mismatches", () => {
    const input = structuredClone(LOAN_REVIEW_WORKSPACE);
    input.regions.bottom.tabs.aggregate.columns.pop();
    const result = parseWorkspaceDefinition(input);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors.some((e) => e.code === "sync_length_mismatch")).toBe(true);
  });

  it("rejects unknown main field ids on aggregate columns", () => {
    const input = structuredClone(LOAN_REVIEW_WORKSPACE);
    input.regions.bottom.tabs.aggregate.columns[0] = {
      syncedFromMain: true,
      fieldId: "notARealField",
    };
    // Keep length equal so we also hit unknown_main_field (and sync mismatch).
    const result = parseWorkspaceDefinition(input);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors.some((e) => e.code === "unknown_main_field")).toBe(true);
  });

  it("rejects duplicate main field ids", () => {
    const input = structuredClone(LOAN_REVIEW_WORKSPACE);
    input.regions.main.fields[1] = {
      id: "borrower",
      name: "Dup",
      type: "text",
    };
    const result = parseWorkspaceDefinition(input);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors.some((e) => e.code === "duplicate_field_id")).toBe(true);
  });
});

describe("SyncedAggregateColumnDefinition", () => {
  it("encodes docs/04 sync in the loan-review fixture types", () => {
    for (const column of LOAN_REVIEW_WORKSPACE.regions.bottom.tabs.aggregate.columns) {
      // Compile-time: syncedFromMain is the literal true.
      expect(column.syncedFromMain).toBe(true);
      expect(
        LOAN_REVIEW_WORKSPACE.regions.main.fields.some(
          (f: { id: string }) => f.id === column.fieldId,
        ),
      ).toBe(true);
    }
  });
});
