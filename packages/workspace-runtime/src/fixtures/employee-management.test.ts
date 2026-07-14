import { describe, expect, it } from "vitest";

import { EMPLOYEE_MANAGEMENT_WORKSPACE } from "./employee-management.js";
import { parseWorkspaceDefinition } from "../parse.js";

describe("EMPLOYEE_MANAGEMENT_WORKSPACE", () => {
  it("parses into a typed layout bound to the employees collection", () => {
    const result = parseWorkspaceDefinition(EMPLOYEE_MANAGEMENT_WORKSPACE);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.layout.id).toBe("employee-management");
    expect(result.layout.name).toBe("Employee Management");
    expect(result.layout.main.dataSource).toBe("employees");
    expect(result.layout.main.columns.map((c) => c.fieldId)).toEqual([
      "name",
      "department",
      "status",
      "salary",
      "tax",
    ]);
    expect(result.layout.bottom.aggregate.columns.map((c) => c.fieldId)).toEqual(
      result.layout.main.columns.map((c) => c.fieldId),
    );
    expect(result.layout.bottom.notes.fields.map((f) => f.id)).toEqual([
      "comments",
      "docLink",
    ]);
    expect(result.layout.form?.sections.map((s) => s.title)).toEqual([
      "Employee Information",
      "Payroll",
    ]);
  });

  it("rejects a loan-shaped field id on the employee form", () => {
    const input = structuredClone(EMPLOYEE_MANAGEMENT_WORKSPACE);
    if (input.form?.sections[0] === undefined) {
      throw new Error("expected form section");
    }
    input.form.sections[0].fieldIds = ["borrower"];
    const result = parseWorkspaceDefinition(input);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors.some((e) => e.code === "unknown_form_field")).toBe(true);
  });
});
