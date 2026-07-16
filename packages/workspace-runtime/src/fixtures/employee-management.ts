import type { WorkspaceDefinition } from "../types.js";

/**
 * Employee Management workspace aligned with `docs/03-workspace-schema-spec.md`
 * (main table from `employees` + bottom Aggregate/Notes) and
 * `apps/mock-server/db.json` `employees`.
 *
 * Side region from the docs/03 prose was folded into bottom Notes per the
 * current two-region layout (`docs/04`).
 */
export const EMPLOYEE_MANAGEMENT_WORKSPACE: WorkspaceDefinition = {
  id: "employee-management",
  name: "Employee Management",
  regions: {
    main: {
      id: "main",
      dataSource: "employees",
      fields: [
        { id: "name", name: "Name", type: "text" },
        { id: "department", name: "Department", type: "text" },
        { id: "status", name: "Status", type: "status" },
        { id: "salary", name: "Salary", type: "currency" },
        { id: "tax", name: "Tax", type: "currency" },
      ],
    },
    bottom: {
      id: "bottom",
      activeTab: "aggregate",
      tabs: {
        aggregate: {
          id: "aggregate",
          columns: [
            { syncedFromMain: true, fieldId: "name" },
            { syncedFromMain: true, fieldId: "department" },
            { syncedFromMain: true, fieldId: "status" },
            { syncedFromMain: true, fieldId: "salary" },
            { syncedFromMain: true, fieldId: "tax" },
          ],
        },
        notes: {
          id: "notes",
          fields: [
            { id: "comments", name: "Comments", type: "text" },
            { id: "docLink", name: "Document", type: "text" },
          ],
        },
      },
    },
  },
};
