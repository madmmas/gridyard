import type { WorkspaceDefinition } from "../types.js";

/**
 * Loan-review workspace aligned with `docs/03-workspace-schema-spec.md`,
 * `docs/workspace-ui-mockup.html`, and `apps/mock-server/db.json` `loans`.
 */
export const LOAN_REVIEW_WORKSPACE: WorkspaceDefinition = {
  id: "loan-review",
  name: "Loan review",
  regions: {
    main: {
      id: "main",
      dataSource: "loans",
      fields: [
        { id: "borrower", name: "Borrower", type: "text" },
        { id: "overdue", name: "Overdue", type: "currency" },
        { id: "status", name: "Status", type: "status" },
        { id: "daysLate", name: "Days late", type: "number" },
      ],
    },
    bottom: {
      id: "bottom",
      activeTab: "aggregate",
      tabs: {
        aggregate: {
          id: "aggregate",
          columns: [
            { syncedFromMain: true, fieldId: "borrower" },
            { syncedFromMain: true, fieldId: "overdue" },
            { syncedFromMain: true, fieldId: "status" },
            { syncedFromMain: true, fieldId: "daysLate" },
          ],
        },
        notes: {
          id: "notes",
          fields: [
            { id: "notes", name: "Notes", type: "text" },
            { id: "docLink", name: "Document", type: "text" },
          ],
        },
      },
    },
  },
  // docs/04 customer-info-form shape: two sections, not a flat field list.
  form: {
    sections: [
      {
        id: "customer",
        title: "Customer Information",
        fieldIds: ["borrower", "status"],
      },
      {
        id: "additional",
        title: "Additional Information",
        fieldIds: ["overdue", "daysLate"],
      },
    ],
  },
};
