import type {
  HierarchyPosition,
  LayeredPermissionDefinition,
} from "../permissions.js";

/**
 * Demo / test permission layers for the Loan Review workspace.
 *
 * Core grants full edit on every field and access to main + bottom.
 * Named users differ meaningfully for UI enforcement demos:
 * - alex: full edit (matches core)
 * - blair: `overdue` is view-only
 * - casey: `daysLate` is hidden; bottom region denied
 */
export const LOAN_REVIEW_PERMISSIONS: LayeredPermissionDefinition = {
  core: {
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
      status: "edit",
      daysLate: "edit",
    },
    layout: {
      canResize: true,
      canPersonalize: true,
      canModifySharedLayout: false,
    },
  },
  users: {
    alex: {
      // Explicit full access — same effective set as core, for clarity in demos.
      fields: {
        borrower: "edit",
        overdue: "edit",
        status: "edit",
        daysLate: "edit",
      },
      regions: { main: true, bottom: true },
    },
    blair: {
      fields: {
        overdue: "view",
      },
    },
    casey: {
      fields: {
        daysLate: "hidden",
      },
      regions: {
        bottom: false,
      },
    },
  },
};

/** Hardcoded sample subjects for the web-demo dropdown. */
export interface SamplePermissionUser {
  /** Stable value for `<select>` options. */
  id: string;
  /** Human-readable label shown in the demo UI. */
  label: string;
  /** Hierarchy position fed to {@link resolvePermissions}. */
  position: HierarchyPosition;
  /** One-line description of how this user’s access differs. */
  summary: string;
}

export const LOAN_REVIEW_SAMPLE_USERS: readonly SamplePermissionUser[] = [
  {
    id: "alex",
    label: "Alex (full edit)",
    position: { userId: "alex" },
    summary: "Can view and edit every field; main and bottom accessible.",
  },
  {
    id: "blair",
    label: "Blair (overdue view-only)",
    position: { userId: "blair" },
    summary: "Overdue is visible but not editable; other fields still editable.",
  },
  {
    id: "casey",
    label: "Casey (hide daysLate)",
    position: { userId: "casey" },
    summary: "Days late column is hidden; bottom region is inaccessible.",
  },
];
