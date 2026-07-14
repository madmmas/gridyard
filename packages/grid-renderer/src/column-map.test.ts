import { describe, expect, it, vi } from "vitest";

import { remapEditableGrid, remapGridDataSource } from "./column-map.js";
import type { EditableGrid } from "./edit.js";
import type { CellJsValue, GridDataSource } from "./types.js";

describe("remapGridDataSource", () => {
  it("reads engine columns in paint order and skips unmapped indices", () => {
    const calls: Array<[number, number]> = [];
    const source: GridDataSource = {
      get_cell(row, col): CellJsValue {
        calls.push([row, col]);
        return { type: "text", value: `${String(row)}:${String(col)}` };
      },
    };
    // Paint cols 0,1 → engine cols 0,2 (engine col 1 hidden).
    const remapped = remapGridDataSource(source, [0, 2]);
    expect(remapped.get_cell(1, 0)).toEqual({ type: "text", value: "1:0" });
    expect(remapped.get_cell(1, 1)).toEqual({ type: "text", value: "1:2" });
    expect(remapped.get_cell(0, 5)).toEqual({ type: "empty" });
    expect(calls).toEqual([
      [1, 0],
      [1, 2],
    ]);
  });
});

describe("remapEditableGrid", () => {
  it("forwards get_input/set_cell through the engine column map", () => {
    const set_cell = vi.fn();
    const grid: EditableGrid = {
      get_cell: () => ({ type: "number", value: 7 }),
      get_input: (row, col) => `r${String(row)}c${String(col)}`,
      set_cell,
    };
    const remapped = remapEditableGrid(grid, [1, 3]);
    expect(remapped.get_input(2, 0)).toBe("r2c1");
    expect(remapped.get_input(2, 1)).toBe("r2c3");
    remapped.set_cell(0, 1, "42");
    expect(set_cell).toHaveBeenCalledWith(0, 3, "42");
    remapped.set_cell(0, 9, "nope");
    expect(set_cell).toHaveBeenCalledTimes(1);
  });
});
