import { describe, expect, it } from "vitest";

import {
  COLUMN_RESIZE_HIT_SLOP,
  hitTestColumnResizeEdge,
  resizeColumnByDelta,
  resizeColumnWithPermission,
  setColumnWidth,
} from "./column-resize.js";
import { computeGridLayout } from "./layout.js";

const layout = computeGridLayout({
  rows: 3,
  cols: 3,
  columnWidths: [100, 80, 120],
});

describe("hitTestColumnResizeEdge", () => {
  it("hits the right edge of a header column within slop", () => {
    const edgeX = layout.gutterWidth + 100;
    expect(
      hitTestColumnResizeEdge(layout, edgeX, layout.refRowHeight),
    ).toBe(0);
    expect(
      hitTestColumnResizeEdge(
        layout,
        edgeX + COLUMN_RESIZE_HIT_SLOP,
        layout.refRowHeight,
      ),
    ).toBe(0);
  });

  it("ignores body clicks when headerOnly is true", () => {
    const edgeX = layout.gutterWidth + 100;
    expect(
      hitTestColumnResizeEdge(layout, edgeX, layout.headerHeight + 10),
    ).toBeNull();
  });

  it("returns null away from edges", () => {
    expect(
      hitTestColumnResizeEdge(layout, layout.gutterWidth + 40, 10),
    ).toBeNull();
  });
});

describe("resizeColumnByDelta / setColumnWidth", () => {
  it("grows and shrinks a column", () => {
    expect(resizeColumnByDelta([100, 80], 0, 20)).toEqual([120, 80]);
    expect(resizeColumnByDelta([100, 80], 1, -10)).toEqual([100, 70]);
  });

  it("clamps to the minimum width", () => {
    expect(setColumnWidth([100, 80], 0, 10, 40)).toEqual([40, 80]);
  });
});

describe("resizeColumnWithPermission", () => {
  it("applies when allowed", () => {
    const result = resizeColumnWithPermission([100, 80], 0, 15, true);
    expect(result).toEqual({ ok: true, widths: [115, 80] });
  });

  it("denies when not allowed", () => {
    const result = resizeColumnWithPermission([100, 80], 0, 15, false);
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected denial");
    }
    expect(result.reason).toBe("permission-denied");
  });
});
