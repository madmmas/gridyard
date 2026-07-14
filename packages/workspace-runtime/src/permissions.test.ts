import { describe, expect, it } from "vitest";

import {
  canAccessRegion,
  canAccessWorkspace,
  canEditField,
  getFieldAccess,
  isFieldHidden,
  mergePermissionLayers,
  resolvePermissions,
  type LayeredPermissionDefinition,
  type PermissionBaseline,
} from "./permissions.js";

const openCore: PermissionBaseline = {
  workspaceAccess: true,
  defaultRegionAccess: true,
  regions: {
    main: true,
    bottom: true,
  },
  defaultFieldAccess: "edit",
  fields: {
    borrower: "edit",
    overdue: "edit",
    salary: "view",
  },
  layout: {
    canResize: true,
    canPersonalize: true,
    canModifySharedLayout: false,
  },
};

describe("resolvePermissions", () => {
  it("falls through to core when no overlays match", () => {
    const definition: LayeredPermissionDefinition = {
      core: openCore,
      companies: {
        acme: { fields: { overdue: "view" } },
      },
    };

    const effective = resolvePermissions(definition, {});

    expect(canAccessWorkspace(effective)).toBe(true);
    expect(canAccessRegion(effective, "main")).toBe(true);
    expect(getFieldAccess(effective, "overdue")).toBe("edit");
    expect(effective.layout).toEqual(openCore.layout);
  });

  it("applies company then department then user in that order", () => {
    const definition: LayeredPermissionDefinition = {
      core: openCore,
      companies: {
        acme: {
          fields: { overdue: "view", salary: "hidden" },
          layout: { canPersonalize: false },
        },
      },
      departments: {
        credit: {
          fields: { overdue: "hidden" },
          layout: { canResize: false },
        },
      },
      users: {
        alice: {
          fields: { overdue: "edit" },
        },
      },
    };

    const companyOnly = resolvePermissions(definition, { companyId: "acme" });
    expect(getFieldAccess(companyOnly, "overdue")).toBe("view");
    expect(getFieldAccess(companyOnly, "salary")).toBe("hidden");
    expect(companyOnly.layout.canPersonalize).toBe(false);
    expect(companyOnly.layout.canResize).toBe(true);

    const withDept = resolvePermissions(definition, {
      companyId: "acme",
      departmentId: "credit",
    });
    // Department overrides company on overdue; salary still company-hidden.
    expect(getFieldAccess(withDept, "overdue")).toBe("hidden");
    expect(getFieldAccess(withDept, "salary")).toBe("hidden");
    expect(withDept.layout.canResize).toBe(false);
    expect(withDept.layout.canPersonalize).toBe(false);

    const withUser = resolvePermissions(definition, {
      companyId: "acme",
      departmentId: "credit",
      userId: "alice",
    });
    expect(getFieldAccess(withUser, "overdue")).toBe("edit");
    expect(getFieldAccess(withUser, "salary")).toBe("hidden");
  });

  it("lets a department override override company without forking core", () => {
    const definition: LayeredPermissionDefinition = {
      core: openCore,
      companies: {
        acme: {
          workspaceAccess: true,
          fields: { salary: "view" },
          regions: { bottom: true },
        },
      },
      departments: {
        hr: {
          fields: { salary: "edit" },
          regions: { bottom: false },
        },
      },
    };

    const effective = resolvePermissions(definition, {
      companyId: "acme",
      departmentId: "hr",
    });

    expect(getFieldAccess(effective, "salary")).toBe("edit");
    expect(canAccessRegion(effective, "bottom")).toBe(false);
    // Unmentioned fields still come from core.
    expect(getFieldAccess(effective, "borrower")).toBe("edit");
  });

  it("skips unknown hierarchy ids without applying other catalog entries", () => {
    const definition: LayeredPermissionDefinition = {
      core: openCore,
      companies: {
        acme: { fields: { overdue: "hidden" } },
      },
    };

    const effective = resolvePermissions(definition, {
      companyId: "other-co",
    });
    expect(getFieldAccess(effective, "overdue")).toBe("edit");
  });
});

describe("mergePermissionLayers", () => {
  it("only overrides keys each layer explicitly sets", () => {
    const effective = mergePermissionLayers({
      core: openCore,
      company: {
        layout: { canModifySharedLayout: true },
      },
      department: {
        layout: { canResize: false },
      },
    });

    expect(effective.layout).toEqual({
      canResize: false,
      canPersonalize: true,
      canModifySharedLayout: true,
    });
    expect(effective.workspaceAccess).toBe(true);
    expect(getFieldAccess(effective, "borrower")).toBe("edit");
  });
});

describe("four permission levels stay distinct", () => {
  it("treats field hidden separately from region access denial", () => {
    const effective = mergePermissionLayers({
      core: openCore,
      user: {
        regions: { bottom: false },
        fields: { notes: "hidden" },
      },
    });

    // Region denied — field access for `notes` is still independently hidden.
    expect(canAccessRegion(effective, "bottom")).toBe(false);
    expect(canAccessRegion(effective, "main")).toBe(true);
    expect(isFieldHidden(effective, "notes")).toBe(true);
    expect(getFieldAccess(effective, "notes")).toBe("hidden");

    // A field can be hidden even when its region remains accessible.
    expect(canAccessRegion(effective, "main")).toBe(true);
    expect(isFieldHidden(effective, "salary")).toBe(false);
    expect(getFieldAccess(effective, "salary")).toBe("view");
    expect(canEditField(effective, "salary")).toBe(false);
  });

  it("keeps workspace denial distinct from region maps", () => {
    const effective = mergePermissionLayers({
      core: openCore,
      company: { workspaceAccess: false },
    });

    expect(canAccessWorkspace(effective)).toBe(false);
    // Region entries are still queryable as their own level.
    expect(canAccessRegion(effective, "main")).toBe(true);
  });

  it("uses core defaults for never-mentioned region and field ids", () => {
    const effective = resolvePermissions({ core: openCore });

    expect(canAccessRegion(effective, "sidebar")).toBe(true);
    expect(getFieldAccess(effective, "unlisted")).toBe("edit");
    expect(canEditField(effective, "borrower")).toBe(true);
  });
});
