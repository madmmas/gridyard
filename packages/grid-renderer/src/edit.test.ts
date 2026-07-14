import { describe, expect, it, vi } from "vitest";

import {
  asEditableGrid,
  beginEdit,
  cancelEdit,
  commitEdit,
  formulaBarText,
  updateDraft,
  type EditableGrid,
} from "./edit.js";
import type { CellJsValue } from "./types.js";

function mockEditableGrid(initial: Record<string, { input: string; value: CellJsValue }>): {
  grid: EditableGrid;
  setCell: ReturnType<typeof vi.fn>;
} {
  const cells = new Map(
    Object.entries(initial).map(([key, cell]) => [key, { ...cell }] as const),
  );
  const keyOf = (row: number, col: number): string => `${String(row)},${String(col)}`;
  const setCell = vi.fn((row: number, col: number, input: string) => {
    const key = keyOf(row, col);
    if (input.startsWith("=") && input.endsWith("+")) {
      cells.set(key, { input, value: { type: "error", kind: "Value" } });
      return;
    }
    if (input.startsWith("=")) {
      cells.set(key, { input, value: { type: "number", value: 99 } });
      return;
    }
    const n = Number(input);
    cells.set(key, {
      input,
      value: Number.isFinite(n) && input.trim() !== "" ? { type: "number", value: n } : { type: "text", value: input },
    });
  });

  return {
    setCell,
    grid: {
      get_cell(row, col): CellJsValue {
        return cells.get(keyOf(row, col))?.value ?? { type: "empty" };
      },
      get_input(row, col): string {
        return cells.get(keyOf(row, col))?.input ?? "";
      },
      set_cell: setCell,
    },
  };
}

describe("edit session", () => {
  it("beginEdit captures original and draft", () => {
    expect(beginEdit({ row: 0, col: 1 }, "=A1+1")).toEqual({
      address: { row: 0, col: 1 },
      draft: "=A1+1",
      original: "=A1+1",
    });
  });

  it("updateDraft changes only the draft text", () => {
    const session = beginEdit({ row: 1, col: 0 }, "10");
    expect(updateDraft(session, "20")).toEqual({
      address: { row: 1, col: 0 },
      draft: "20",
      original: "10",
    });
  });

  it("commitEdit calls set_cell with the draft and does not throw on bad formulas", () => {
    const { grid, setCell } = mockEditableGrid({
      "0,0": { input: "1", value: { type: "number", value: 1 } },
      "0,1": { input: "=A1+1", value: { type: "number", value: 2 } },
    });
    const session = updateDraft(beginEdit({ row: 0, col: 1 }, "=A1+1"), "=A1+");
    const result = commitEdit(grid, session);
    expect(setCell).toHaveBeenCalledWith(0, 1, "=A1+");
    expect(result).toEqual({ address: { row: 0, col: 1 }, input: "=A1+" });
    expect(grid.get_cell(0, 1)).toEqual({ type: "error", kind: "Value" });
  });

  it("cancelEdit restores original and never calls set_cell", () => {
    const { grid, setCell } = mockEditableGrid({
      "0,0": { input: "Ada", value: { type: "text", value: "Ada" } },
    });
    const session = updateDraft(beginEdit({ row: 0, col: 0 }, "Ada"), "Grace");
    expect(cancelEdit(session)).toEqual({
      address: { row: 0, col: 0 },
      input: "Ada",
    });
    expect(setCell).not.toHaveBeenCalled();
    expect(grid.get_input(0, 0)).toBe("Ada");
  });

  it("formulaBarText reads raw input for the selection", () => {
    const { grid } = mockEditableGrid({
      "2,3": { input: "=IF(D3,1,0)", value: { type: "number", value: 1 } },
    });
    expect(formulaBarText(grid, { row: 2, col: 3 })).toBe("=IF(D3,1,0)");
    expect(formulaBarText(grid, null)).toBe("");
    expect(formulaBarText(grid, { row: 0, col: 0 })).toBe("");
  });
});

describe("asEditableGrid", () => {
  it("normalizes get_cell and forwards get_input/set_cell", () => {
    const set_cell = vi.fn();
    const editable = asEditableGrid({
      get_cell: () => ({ type: "number", value: 3 }),
      get_input: () => "=A1",
      set_cell,
    });
    expect(editable.get_cell(0, 0)).toEqual({ type: "number", value: 3 });
    expect(editable.get_input(1, 2)).toBe("=A1");
    editable.set_cell(0, 1, "9");
    expect(set_cell).toHaveBeenCalledWith(0, 1, "9");
  });
});
