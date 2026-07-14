import { describe, expect, it } from "vitest";

import type { BoundMainGrid, WorkspaceLayout } from "@gridyard/workspace-runtime";
import { LOAN_REVIEW_WORKSPACE, parseWorkspaceDefinition } from "@gridyard/workspace-runtime";

import { loadLoanReviewMain } from "./load-loan-review.js";
import {
  boundValueToInput,
  paintConfigFromLayout,
  seedBottomAggregate,
  seedGridFromBoundMain,
} from "./seed-from-bound-grid.js";

function loanLayout(): WorkspaceLayout {
  const parsed = parseWorkspaceDefinition(LOAN_REVIEW_WORKSPACE);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    throw new Error("fixture layout failed");
  }
  return parsed.layout;
}

describe("boundValueToInput", () => {
  it("formats scalars for set_cell", () => {
    expect(boundValueToInput(null)).toBe("");
    expect(boundValueToInput("Alam")).toBe("Alam");
    expect(boundValueToInput(8400)).toBe("8400");
    expect(boundValueToInput(true)).toBe("TRUE");
    expect(boundValueToInput(false)).toBe("FALSE");
  });
});

describe("seedGridFromBoundMain", () => {
  it("writes row-major cells in layout column order", () => {
    const calls: Array<[number, number, string]> = [];
    const grid = {
      set_cell(row: number, col: number, input: string): void {
        calls.push([row, col, input]);
      },
    };
    const bound: BoundMainGrid = {
      dataSource: "loans",
      rows: [
        {
          borrower: "Alam Textiles",
          overdue: 8400,
          status: "Overdue",
          daysLate: 14,
        },
      ],
      cells: [["Alam Textiles", 8400, "Overdue", 14]],
    };

    const dims = seedGridFromBoundMain(grid, bound);
    expect(dims).toEqual({ rows: 1, cols: 4 });
    expect(calls).toEqual([
      [0, 0, "Alam Textiles"],
      [0, 1, "8400"],
      [0, 2, "Overdue"],
      [0, 3, "14"],
    ]);
  });
});

describe("paintConfigFromLayout", () => {
  it("derives column names and numeric columns from the loan-review layout", () => {
    const config = paintConfigFromLayout(loanLayout(), 7);
    expect(config.rows).toBe(7);
    expect(config.cols).toBe(4);
    expect(config.columnNames).toEqual([
      "Borrower",
      "Overdue",
      "Status",
      "Days late",
    ]);
    expect([...config.numericColumns].sort((a, b) => a - b)).toEqual([1, 3]);
  });
});

describe("seedBottomAggregate", () => {
  it("writes Total/Average labels and main! SUM/AVERAGE formulas", () => {
    const calls: Array<[number, number, string]> = [];
    const grid = {
      set_cell(row: number, col: number, input: string): void {
        calls.push([row, col, input]);
      },
    };
    const dims = seedBottomAggregate(grid, 7, 4, new Set([1, 3]));
    expect(dims).toEqual({ rows: 2, cols: 4 });
    expect(calls).toContainEqual([0, 0, "Total (7)"]);
    expect(calls).toContainEqual([1, 0, "Average"]);
    expect(calls).toContainEqual([0, 1, "=SUM(main!B1:B7)"]);
    expect(calls).toContainEqual([1, 1, "=AVERAGE(main!B1:B7)"]);
    expect(calls).toContainEqual([0, 2, "—"]);
    expect(calls).toContainEqual([0, 3, "=SUM(main!D1:D7)"]);
  });
});

describe("loadLoanReviewMain", () => {
  it("binds loans through an injected adapter onto the workspace layout", async () => {
    const loans = [
      {
        id: 1,
        borrower: "Alam Textiles",
        overdue: 8400,
        status: "Overdue",
        daysLate: 14,
      },
      {
        id: 2,
        borrower: "Nirvana Foods",
        overdue: 2100,
        status: "Active",
        daysLate: 0,
      },
    ];

    const result = await loadLoanReviewMain({
      adapter: {
        fetchRecords: (collection) => {
          expect(collection).toBe("loans");
          return Promise.resolve({ ok: true, records: loans });
        },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.layout.main.dataSource).toBe("loans");
    expect(result.grid.rows).toHaveLength(2);
    expect(result.grid.cells[0]).toEqual(["Alam Textiles", 8400, "Overdue", 14]);
  });

  it("surfaces adapter failures without throwing", async () => {
    const result = await loadLoanReviewMain({
      adapter: {
        fetchRecords: () =>
          Promise.resolve({
            ok: false,
            error: {
              code: "http",
              status: 503,
              message: "down",
              collection: "loans",
            },
          }),
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("http");
  });
});
