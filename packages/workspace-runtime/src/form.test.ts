import { describe, expect, it } from "vitest";

import { bindRecordsToMainGrid } from "./binding.js";
import { LOAN_REVIEW_WORKSPACE } from "./fixtures/loan-review.js";
import {
  LOAN_REVIEW_PERMISSIONS,
  LOAN_REVIEW_SAMPLE_USERS,
} from "./fixtures/loan-review-permissions.js";
import { buildFormView, formatFormValue } from "./form.js";
import { parseWorkspaceDefinition } from "./parse.js";
import { resolvePermissions } from "./permissions.js";

function loanLayout() {
  const parsed = parseWorkspaceDefinition(LOAN_REVIEW_WORKSPACE);
  if (!parsed.ok) {
    throw new Error("expected loan-review fixture to parse");
  }
  return parsed.layout;
}

function alexPermissions() {
  const alex = LOAN_REVIEW_SAMPLE_USERS[0];
  if (alex === undefined) {
    throw new Error("expected alex sample user");
  }
  return resolvePermissions(LOAN_REVIEW_PERMISSIONS, alex.position);
}

describe("buildFormView", () => {
  it("projects a bound loan row into two distinct form sections", () => {
    const layout = loanLayout();
    expect(layout.form?.sections).toHaveLength(2);

    const bound = bindRecordsToMainGrid(
      [
        {
          borrower: "Alam Textiles",
          overdue: 8400,
          status: "Overdue",
          daysLate: 14,
        },
      ],
      layout,
    );
    expect(bound.ok).toBe(true);
    if (!bound.ok) {
      return;
    }
    const row = bound.grid.rows[0];
    if (row === undefined) {
      throw new Error("expected a bound row");
    }

    const form = buildFormView(layout, row, alexPermissions());
    expect(form).not.toBeNull();
    if (form === null) {
      return;
    }

    expect(form.sections.map((s) => s.title)).toEqual([
      "Customer Information",
      "Additional Information",
    ]);
    expect(form.sections[0]?.fields.map((f) => f.fieldId)).toEqual([
      "borrower",
      "status",
    ]);
    expect(form.sections[1]?.fields.map((f) => f.fieldId)).toEqual([
      "overdue",
      "daysLate",
    ]);
    expect(form.sections[0]?.fields[0]).toMatchObject({
      label: "Borrower",
      value: "Alam Textiles",
      access: "edit",
    });
    expect(form.sections[1]?.fields[0]).toMatchObject({
      label: "Overdue",
      value: 8400,
      access: "edit",
    });
  });

  it("omits hidden fields and marks view-only access (same as grid)", () => {
    const layout = loanLayout();
    const bound = bindRecordsToMainGrid(
      [
        {
          borrower: "Alam Textiles",
          overdue: 8400,
          status: "Overdue",
          daysLate: 14,
        },
      ],
      layout,
    );
    expect(bound.ok).toBe(true);
    if (!bound.ok) {
      return;
    }
    const row = bound.grid.rows[0];
    if (row === undefined) {
      throw new Error("expected a bound row");
    }

    const casey = LOAN_REVIEW_SAMPLE_USERS.find((u) => u.id === "casey");
    const blair = LOAN_REVIEW_SAMPLE_USERS.find((u) => u.id === "blair");
    if (casey === undefined || blair === undefined) {
      throw new Error("expected casey and blair sample users");
    }

    const caseyForm = buildFormView(
      layout,
      row,
      resolvePermissions(LOAN_REVIEW_PERMISSIONS, casey.position),
    );
    expect(caseyForm).not.toBeNull();
    if (caseyForm === null) {
      return;
    }
    const caseyFieldIds = caseyForm.sections.flatMap((s) =>
      s.fields.map((f) => f.fieldId),
    );
    expect(caseyFieldIds).not.toContain("daysLate");
    expect(caseyFieldIds).toEqual(
      expect.arrayContaining(["borrower", "status", "overdue"]),
    );

    const blairForm = buildFormView(
      layout,
      row,
      resolvePermissions(LOAN_REVIEW_PERMISSIONS, blair.position),
    );
    expect(blairForm).not.toBeNull();
    if (blairForm === null) {
      return;
    }
    const overdue = blairForm.sections
      .flatMap((s) => s.fields)
      .find((f) => f.fieldId === "overdue");
    expect(overdue?.access).toBe("view");
    expect(
      blairForm.sections
        .flatMap((s) => s.fields)
        .find((f) => f.fieldId === "borrower")?.access,
    ).toBe("edit");
  });

  it("returns null when the layout has no form definition", () => {
    const layout = loanLayout();
    const { form: _omit, ...withoutForm } = layout;
    void _omit;
    const form = buildFormView(
      withoutForm,
      { borrower: "Ada" },
      alexPermissions(),
    );
    expect(form).toBeNull();
  });

  it("drops a section entirely when every field is hidden", () => {
    const layout = loanLayout();
    // Hide both Additional Information fields.
    const effective = resolvePermissions(
      {
        ...LOAN_REVIEW_PERMISSIONS,
        users: {
          ...LOAN_REVIEW_PERMISSIONS.users,
          hideExtra: {
            fields: { overdue: "hidden", daysLate: "hidden" },
          },
        },
      },
      { userId: "hideExtra" },
    );
    const form = buildFormView(
      layout,
      {
        borrower: "Ada",
        overdue: 1,
        status: "Active",
        daysLate: 0,
      },
      effective,
    );
    expect(form).not.toBeNull();
    if (form === null) {
      return;
    }
    expect(form.sections).toHaveLength(1);
    expect(form.sections[0]?.title).toBe("Customer Information");
  });
});

describe("formatFormValue", () => {
  it("stringifies scalars and treats null as empty", () => {
    expect(formatFormValue(null)).toBe("");
    expect(formatFormValue(42)).toBe("42");
    expect(formatFormValue("hi")).toBe("hi");
    expect(formatFormValue(true)).toBe("TRUE");
    expect(formatFormValue(false)).toBe("FALSE");
  });
});
