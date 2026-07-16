/**
 * Client-side multi-thousand-row Loan Review grid for demonstrating
 * virtualization and rAF paint batching in the running demo.
 *
 * Keeps the mock-server `loans` fixture small and docs-aligned; this path
 * bypasses REST when the demo's "5k rows" toggle is on.
 */

import type {
  BoundCellValue,
  BoundMainGrid,
  BoundRow,
} from "@gridyard/workspace-runtime";

/** Default synthetic row count (matches grid-renderer virtualization tests). */
export const SYNTHETIC_LOAN_ROW_COUNT = 5000;

/**
 * 0-based row whose overdue cell is `=B1` so an off-screen formula can be
 * scrolled into view and checked for a correct, already-computed value.
 */
export const SYNTHETIC_OFFSCREEN_FORMULA_ROW = 2499;

/** Rows 1..N whose daysLate cell is `=B1` (cascade dependents for rAF demos). */
export const SYNTHETIC_CASCADE_DEPENDENT_ROWS = 20;

const STATUSES = ["Overdue", "Active", "Closed"] as const;

/**
 * Builds a Loan Review–shaped `BoundMainGrid` with `rowCount` data rows.
 * Grid `cells` may contain formulas; `rows` stay literal scalars for
 * binding/record consumers.
 */
export function generateSyntheticLoans(rowCount: number): BoundMainGrid {
  if (!Number.isFinite(rowCount) || rowCount < 0) {
    throw new RangeError("rowCount must be a non-negative finite number");
  }
  const count = Math.floor(rowCount);
  const rows: BoundRow[] = [];
  const cells: BoundCellValue[][] = [];

  for (let i = 0; i < count; i += 1) {
    const borrower = `Borrower ${String(i + 1).padStart(4, "0")}`;
    const overdue = (i % 50) * 100 + (i % 7) * 37;
    const status = STATUSES[i % STATUSES.length] ?? "Active";
    const daysLate = status === "Overdue" ? (i % 40) + 1 : 0;

    let overdueCell: BoundCellValue = overdue;
    let daysLateCell: BoundCellValue = daysLate;

    if (i === SYNTHETIC_OFFSCREEN_FORMULA_ROW) {
      overdueCell = "=B1";
    }
    if (i >= 1 && i <= SYNTHETIC_CASCADE_DEPENDENT_ROWS) {
      daysLateCell = "=B1";
    }

    cells.push([borrower, overdueCell, status, daysLateCell]);
    rows.push({
      borrower,
      overdue,
      status,
      daysLate,
    });
  }

  return {
    dataSource: "loans",
    cells,
    rows,
  };
}
