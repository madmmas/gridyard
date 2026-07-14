/**
 * Open-access permission layers for Employee Management demos.
 *
 * Loan Review keeps Alex/Blair/Casey overlays; this workspace uses a
 * single full-edit subject so the demo switcher does not pretend
 * Loan-Review users map onto HR fields.
 */
import type {
  HierarchyPosition,
  LayeredPermissionDefinition,
} from "../permissions.js";
import type { SamplePermissionUser } from "./loan-review-permissions.js";

export const EMPLOYEE_MANAGEMENT_PERMISSIONS: LayeredPermissionDefinition = {
  core: {
    workspaceAccess: true,
    defaultRegionAccess: true,
    regions: {
      main: true,
      bottom: true,
    },
    defaultFieldAccess: "edit",
    fields: {
      name: "edit",
      department: "edit",
      status: "edit",
      salary: "edit",
      tax: "edit",
    },
    layout: {
      canResize: true,
      canPersonalize: true,
      canModifySharedLayout: false,
    },
  },
  users: {
    hr: {
      fields: {
        name: "edit",
        department: "edit",
        status: "edit",
        salary: "edit",
        tax: "edit",
      },
      regions: { main: true, bottom: true },
    },
  },
};

export const EMPLOYEE_MANAGEMENT_SAMPLE_USERS: readonly SamplePermissionUser[] = [
  {
    id: "hr",
    label: "HR (full edit)",
    position: { userId: "hr" } satisfies HierarchyPosition,
    summary: "Can view and edit every employee field; main and bottom accessible.",
  },
];
