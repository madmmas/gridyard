import { describe, expect, it } from "vitest";

import {
  SYNTHETIC_CASCADE_DEPENDENT_ROWS,
  SYNTHETIC_LOAN_ROW_COUNT,
  SYNTHETIC_OFFSCREEN_FORMULA_ROW,
  generateSyntheticLoans,
} from "./synthetic-loans.js";

describe("generateSyntheticLoans", () => {
  it("builds the requested row count with loan-shaped columns", () => {
    const grid = generateSyntheticLoans(3);
    expect(grid.dataSource).toBe("loans");
    expect(grid.cells).toHaveLength(3);
    expect(grid.rows).toHaveLength(3);
    expect(grid.cells[0]?.[0]).toBe("Borrower 0001");
    expect(typeof grid.cells[0]?.[1]).toBe("number");
    expect(typeof grid.cells[0]?.[2]).toBe("string");
    expect(typeof grid.cells[0]?.[3]).toBe("number");
    expect(grid.rows[0]?.borrower).toBe("Borrower 0001");
    expect(typeof grid.rows[0]?.status).toBe("string");
  });

  it("places an off-screen formula and cascade dependents at known rows", () => {
    const grid = generateSyntheticLoans(SYNTHETIC_LOAN_ROW_COUNT);
    expect(grid.cells).toHaveLength(SYNTHETIC_LOAN_ROW_COUNT);

    const formulaRow = grid.cells[SYNTHETIC_OFFSCREEN_FORMULA_ROW];
    expect(formulaRow?.[1]).toBe("=B1");

    for (let i = 1; i <= SYNTHETIC_CASCADE_DEPENDENT_ROWS; i += 1) {
      expect(grid.cells[i]?.[3]).toBe("=B1");
    }
    // Bound rows stay literal for the form panel.
    expect(typeof grid.rows[SYNTHETIC_OFFSCREEN_FORMULA_ROW]?.overdue).toBe(
      "number",
    );
  });

  it("returns an empty grid for zero rows and rejects negatives", () => {
    expect(generateSyntheticLoans(0)).toEqual({
      dataSource: "loans",
      cells: [],
      rows: [],
    });
    expect(() => generateSyntheticLoans(-1)).toThrow(RangeError);
  });
});
