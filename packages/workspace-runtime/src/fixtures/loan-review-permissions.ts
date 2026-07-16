import type {
  HierarchyPosition,
  LayeredPermissionDefinition,
} from "../permissions.js";

/**
 * Demo / test permission layers for the Loan Review workspace.
 *
 * Core grants full edit on every field and access to main + bottom.
 * Named users differ meaningfully for UI enforcement demos:
 * - alex: full edit; may modify the shared layout (admin-like)
 * - blair: `overdue` is view-only; cannot resize columns
 * - casey: `daysLate` is hidden; bottom region denied; cannot personalize
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
      layout: {
        canModifySharedLayout: true,
      },
    },
    blair: {
      fields: {
        overdue: "view",
      },
      layout: {
        canResize: false,
      },
    },
    casey: {
      fields: {
        daysLate: "hidden",
      },
      regions: {
        bottom: false,
      },
      layout: {
        canPersonalize: false,
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
    label: "Alex (full edit + shared layout)",
    position: { userId: "alex" },
    summary:
      "Can edit every field, resize columns, and reset the shared layout.",
  },
  {
    id: "blair",
    label: "Blair (overdue view-only, no resize)",
    position: { userId: "blair" },
    summary:
      "Overdue is view-only; column resize is blocked by layout permissions.",
  },
  {
    id: "casey",
    label: "Casey (hide daysLate, no personalize)",
    position: { userId: "casey" },
    summary:
      "Days late hidden; bottom denied; cannot personalize layout.",
  },
];
