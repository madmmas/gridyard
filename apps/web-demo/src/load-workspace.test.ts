import { describe, expect, it } from "vitest";

import {
  EMPLOYEE_MANAGEMENT_WORKSPACE,
  LOAN_REVIEW_WORKSPACE,
  type DataAdapter,
} from "@gridyard/workspace-runtime";

import { loadWorkspaceMain } from "./load-workspace.js";

describe("loadWorkspaceMain", () => {
  it("binds loans through an injected adapter onto the loan-review layout", async () => {
    const loans = [
      {
        id: 1,
        borrower: "Alam Textiles",
        overdue: 8400,
        status: "Overdue",
        daysLate: 14,
      },
    ];
    const result = await loadWorkspaceMain(LOAN_REVIEW_WORKSPACE, {
      adapter: {
        fetchRecords(collection: string) {
          expect(collection).toBe("loans");
          return Promise.resolve({ ok: true, records: loans });
        },
      } satisfies DataAdapter,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.layout.main.dataSource).toBe("loans");
    expect(result.grid.rows[0]?.["borrower"]).toBe("Alam Textiles");
    expect(result.layout.form?.sections).toHaveLength(2);
  });

  it("binds employees through the same loader path", async () => {
    const employees = [
      {
        id: 1,
        name: "Farida Rahman",
        department: "Finance",
        status: "Active",
        salary: 68000,
        tax: 9200,
      },
    ];
    const result = await loadWorkspaceMain(EMPLOYEE_MANAGEMENT_WORKSPACE, {
      adapter: {
        fetchRecords(collection: string) {
          expect(collection).toBe("employees");
          return Promise.resolve({ ok: true, records: employees });
        },
      } satisfies DataAdapter,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.layout.id).toBe("employee-management");
    expect(result.grid.rows[0]?.["name"]).toBe("Farida Rahman");
    expect(result.grid.rows[0]?.["salary"]).toBe(68000);
  });

  it("surfaces adapter errors without throwing", async () => {
    const result = await loadWorkspaceMain(EMPLOYEE_MANAGEMENT_WORKSPACE, {
      adapter: {
        fetchRecords() {
          return Promise.resolve({
            ok: false,
            error: {
              code: "http",
              status: 404,
              message: "missing",
              collection: "employees",
            },
          });
        },
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.message).toBe("missing");
  });
});
