import { describe, expect, it } from "vitest";

import {
  LOAN_REVIEW_PERMISSIONS,
  LOAN_REVIEW_SAMPLE_USERS,
} from "./fixtures/loan-review-permissions.js";
import {
  accessForPaintColumn,
  authorizeFieldEdit,
  isRegionVisible,
  projectColumnsForPermissions,
} from "./permission-ui.js";
import {
  getFieldAccess,
  isFieldHidden,
  resolvePermissions,
} from "./permissions.js";
import type { LayoutColumn } from "./types.js";

const LOAN_COLUMNS: LayoutColumn[] = [
  { fieldId: "borrower", name: "Borrower", type: "text", colIndex: 0 },
  { fieldId: "overdue", name: "Overdue", type: "currency", colIndex: 1 },
  { fieldId: "status", name: "Status", type: "status", colIndex: 2 },
  { fieldId: "daysLate", name: "Days late", type: "number", colIndex: 3 },
];

describe("LOAN_REVIEW_PERMISSIONS sample users", () => {
  it("exposes three meaningfully different sample users", () => {
    expect(LOAN_REVIEW_SAMPLE_USERS).toHaveLength(3);
    const byId = Object.fromEntries(
      LOAN_REVIEW_SAMPLE_USERS.map((u) => [u.id, u]),
    );

    const alexUser = byId.alex;
    const blairUser = byId.blair;
    const caseyUser = byId.casey;
    expect(alexUser).toBeDefined();
    expect(blairUser).toBeDefined();
    expect(caseyUser).toBeDefined();
    if (alexUser === undefined || blairUser === undefined || caseyUser === undefined) {
      throw new Error("expected sample users alex, blair, and casey");
    }

    const alex = resolvePermissions(LOAN_REVIEW_PERMISSIONS, alexUser.position);
    expect(getFieldAccess(alex, "overdue")).toBe("edit");
    expect(getFieldAccess(alex, "daysLate")).toBe("edit");
    expect(isRegionVisible(alex, "bottom")).toBe(true);

    const blair = resolvePermissions(LOAN_REVIEW_PERMISSIONS, blairUser.position);
    expect(getFieldAccess(blair, "overdue")).toBe("view");
    expect(isFieldHidden(blair, "daysLate")).toBe(false);

    const casey = resolvePermissions(LOAN_REVIEW_PERMISSIONS, caseyUser.position);
    expect(isFieldHidden(casey, "daysLate")).toBe(true);
    expect(isRegionVisible(casey, "bottom")).toBe(false);
  });
});

describe("projectColumnsForPermissions", () => {
  it("omits hidden fields from the paint projection", () => {
    const casey = resolvePermissions(LOAN_REVIEW_PERMISSIONS, {
      userId: "casey",
    });
    const projection = projectColumnsForPermissions(LOAN_COLUMNS, casey);

    expect(projection.columnNames).toEqual([
      "Borrower",
      "Overdue",
      "Status",
    ]);
    expect(projection.engineColIndices).toEqual([0, 1, 2]);
    expect(projection.columns.map((c) => c.fieldId)).not.toContain(
      "daysLate",
    );
  });

  it("keeps view-only fields visible with access view", () => {
    const blair = resolvePermissions(LOAN_REVIEW_PERMISSIONS, {
      userId: "blair",
    });
    const projection = projectColumnsForPermissions(LOAN_COLUMNS, blair);

    expect(projection.engineColIndices).toEqual([0, 1, 2, 3]);
    expect(accessForPaintColumn(projection, 1)).toBe("view");
    expect(projection.columns[1]?.fieldId).toBe("overdue");
  });

  it("full-access user keeps every column editable", () => {
    const alex = resolvePermissions(LOAN_REVIEW_PERMISSIONS, {
      userId: "alex",
    });
    const projection = projectColumnsForPermissions(LOAN_COLUMNS, alex);

    expect(projection.columns).toHaveLength(4);
    expect(projection.columns.every((c) => c.access === "edit")).toBe(true);
  });
});

describe("authorizeFieldEdit", () => {
  it("allows edit access and rejects view-only with a clear message", () => {
    const blair = resolvePermissions(LOAN_REVIEW_PERMISSIONS, {
      userId: "blair",
    });
    expect(authorizeFieldEdit(blair, "borrower")).toEqual({ ok: true });
    const denied = authorizeFieldEdit(blair, "overdue");
    expect(denied.ok).toBe(false);
    if (denied.ok) {
      throw new Error("expected denial");
    }
    expect(denied.access).toBe("view");
    expect(denied.message).toMatch(/overdue/);
    expect(denied.message).toMatch(/view/);
  });
});
