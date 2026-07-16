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
  });
});
