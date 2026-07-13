import { describe, expect, it } from "vitest";

import { columnLeft, computeGridLayout, dataCellRect } from "./layout.js";

describe("computeGridLayout", () => {
  it("sizes a mockup-like 4×3 grid", () => {
    const layout = computeGridLayout({
      rows: 3,
      cols: 4,
      columnWidths: [168, 90, 84, 90],
      gutterWidth: 26,
      refRowHeight: 22,
      nameRowHeight: 30,
      rowHeight: 34,
    });

    expect(layout.headerHeight).toBe(52);
    expect(layout.bodyHeight).toBe(102);
    expect(layout.totalWidth).toBe(26 + 168 + 90 + 84 + 90);
    expect(layout.totalHeight).toBe(52 + 102);
  });

  it("fills missing column widths with the default", () => {
    const layout = computeGridLayout({ rows: 1, cols: 2, defaultColumnWidth: 50 });
    expect(layout.columnWidths).toEqual([50, 50]);
    expect(layout.totalWidth).toBe(26 + 100);
  });

  it("rejects negative dimensions", () => {
    expect(() => computeGridLayout({ rows: -1, cols: 1 })).toThrow(RangeError);
  });
});

describe("dataCellRect", () => {
  it("places the first data cell below headers and beside the gutter", () => {
    const layout = computeGridLayout({
      rows: 2,
      cols: 2,
      columnWidths: [100, 80],
      gutterWidth: 26,
      refRowHeight: 20,
      nameRowHeight: 30,
      rowHeight: 34,
    });
    expect(dataCellRect(layout, 0, 0)).toEqual({
      x: 26,
      y: 50,
      width: 100,
      height: 34,
    });
    expect(dataCellRect(layout, 1, 1)).toEqual({
      x: 26 + 100,
      y: 50 + 34,
      width: 80,
      height: 34,
    });
    expect(columnLeft(layout, 1)).toBe(126);
  });
});
