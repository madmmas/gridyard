import { describe, expect, it } from "vitest";

import { computeGridLayout } from "./layout.js";
import {
  clampSelection,
  hitTestDataCell,
  isSelectionNavKey,
  moveSelection,
} from "./selection.js";

const bounds = { rows: 3, cols: 4 };

describe("clampSelection", () => {
  it("keeps an in-range address", () => {
    expect(clampSelection({ row: 1, col: 2 }, bounds)).toEqual({ row: 1, col: 2 });
  });

  it("clamps past the last row/col", () => {
    expect(clampSelection({ row: 99, col: 99 }, bounds)).toEqual({ row: 2, col: 3 });
  });

  it("clamps negative coordinates to the origin", () => {
    expect(clampSelection({ row: -1, col: -4 }, bounds)).toEqual({ row: 0, col: 0 });
  });

  it("returns null for an empty grid", () => {
    expect(clampSelection({ row: 0, col: 0 }, { rows: 0, cols: 4 })).toBeNull();
    expect(clampSelection({ row: 0, col: 0 }, { rows: 3, cols: 0 })).toBeNull();
  });
});

describe("moveSelection", () => {
  it("moves one cell with arrow keys", () => {
    const start = { row: 1, col: 1 };
    expect(moveSelection(start, "ArrowUp", bounds)).toEqual({ row: 0, col: 1 });
    expect(moveSelection(start, "ArrowDown", bounds)).toEqual({ row: 2, col: 1 });
    expect(moveSelection(start, "ArrowLeft", bounds)).toEqual({ row: 1, col: 0 });
    expect(moveSelection(start, "ArrowRight", bounds)).toEqual({ row: 1, col: 2 });
  });

  it("moves down on Enter and right on Tab", () => {
    const start = { row: 0, col: 0 };
    expect(moveSelection(start, "Enter", bounds)).toEqual({ row: 1, col: 0 });
    expect(moveSelection(start, "Tab", bounds)).toEqual({ row: 0, col: 1 });
  });

  it("stays put at edges instead of going out of bounds", () => {
    expect(moveSelection({ row: 0, col: 0 }, "ArrowUp", bounds)).toEqual({
      row: 0,
      col: 0,
    });
    expect(moveSelection({ row: 0, col: 0 }, "ArrowLeft", bounds)).toEqual({
      row: 0,
      col: 0,
    });
    expect(moveSelection({ row: 2, col: 3 }, "ArrowDown", bounds)).toEqual({
      row: 2,
      col: 3,
    });
    expect(moveSelection({ row: 2, col: 3 }, "Enter", bounds)).toEqual({
      row: 2,
      col: 3,
    });
    expect(moveSelection({ row: 2, col: 3 }, "Tab", bounds)).toEqual({
      row: 2,
      col: 3,
    });
    expect(moveSelection({ row: 2, col: 3 }, "ArrowRight", bounds)).toEqual({
      row: 2,
      col: 3,
    });
  });

  it("seeds at A1 when there is no current selection", () => {
    expect(moveSelection(null, "ArrowDown", bounds)).toEqual({ row: 1, col: 0 });
    expect(moveSelection(null, "Tab", bounds)).toEqual({ row: 0, col: 1 });
    expect(moveSelection(null, "ArrowUp", bounds)).toEqual({ row: 0, col: 0 });
  });

  it("returns null when the grid has no cells", () => {
    expect(moveSelection({ row: 0, col: 0 }, "Tab", { rows: 0, cols: 0 })).toBeNull();
  });
});

describe("isSelectionNavKey", () => {
  it("accepts the documented navigation keys only", () => {
    expect(isSelectionNavKey("ArrowUp")).toBe(true);
    expect(isSelectionNavKey("Enter")).toBe(true);
    expect(isSelectionNavKey("Tab")).toBe(true);
    expect(isSelectionNavKey("Escape")).toBe(false);
    expect(isSelectionNavKey("a")).toBe(false);
  });
});

describe("hitTestDataCell", () => {
  const layout = computeGridLayout({
    rows: 3,
    cols: 4,
    columnWidths: [168, 90, 84, 90],
    gutterWidth: 26,
    refRowHeight: 22,
    nameRowHeight: 30,
    rowHeight: 34,
  });

  it("maps a point inside the first data cell", () => {
    expect(hitTestDataCell(layout, 26 + 10, 52 + 10, bounds)).toEqual({
      row: 0,
      col: 0,
    });
  });

  it("maps a point in a later cell", () => {
    // col 2 starts at 26 + 168 + 90 = 284; row 1 starts at 52 + 34 = 86
    expect(hitTestDataCell(layout, 284 + 5, 86 + 5, bounds)).toEqual({
      row: 1,
      col: 2,
    });
  });

  it("ignores header and gutter clicks", () => {
    expect(hitTestDataCell(layout, 26 + 10, 10, bounds)).toBeNull();
    expect(hitTestDataCell(layout, 10, 52 + 10, bounds)).toBeNull();
  });

  it("ignores clicks outside the grid", () => {
    expect(hitTestDataCell(layout, layout.totalWidth + 1, 60, bounds)).toBeNull();
    expect(hitTestDataCell(layout, 40, layout.totalHeight + 1, bounds)).toBeNull();
  });
});
