import { describe, expect, it } from "vitest";

import {
  clampScrollTop,
  scrollTopToRevealRow,
  viewportBodyHeight,
  visibleRowRange,
} from "./viewport.js";

describe("visibleRowRange", () => {
  const base = {
    headerHeight: 52,
    rowHeight: 34,
    totalRows: 1000,
    viewportHeight: 52 + 34 * 10, // header + 10 body rows
  };

  it("maps scrollTop 0 to the first window of rows", () => {
    const range = visibleRowRange({ ...base, scrollTop: 0 });
    expect(range.startRow).toBe(0);
    // 10 full rows + 1 partial trailing → endRow 11
    expect(range.endRow).toBe(11);
  });

  it("advances the window when scrolling by row height", () => {
    const range = visibleRowRange({ ...base, scrollTop: 34 * 40 });
    expect(range.startRow).toBe(40);
    expect(range.endRow).toBe(51);
  });

  it("returns an empty window when scrolled past the last row", () => {
    const range = visibleRowRange({
      ...base,
      totalRows: 45,
      scrollTop: 34 * 100,
    });
    expect(range).toEqual({ startRow: 45, endRow: 45 });
  });

  it("applies overscan above and below", () => {
    const range = visibleRowRange({
      ...base,
      scrollTop: 34 * 20,
      overscan: 2,
    });
    expect(range.startRow).toBe(18);
    expect(range.endRow).toBe(33); // 20+11+2
  });

  it("returns an empty range for empty sheets", () => {
    expect(
      visibleRowRange({ ...base, totalRows: 0, scrollTop: 0 }),
    ).toEqual({ startRow: 0, endRow: 0 });
  });

  it("returns an empty range when the body has no height", () => {
    expect(
      visibleRowRange({
        ...base,
        viewportHeight: 40, // less than header
        scrollTop: 0,
      }),
    ).toEqual({ startRow: 0, endRow: 0 });
  });
});

describe("clampScrollTop", () => {
  it("clamps past the last row", () => {
    // 100 rows × 34 = 3400; viewport body 340 → max scroll 3060
    expect(clampScrollTop(99999, 100, 34, 340)).toBe(3400 - 340);
  });

  it("does not go negative", () => {
    expect(clampScrollTop(-10, 100, 34, 340)).toBe(0);
  });
});

describe("scrollTopToRevealRow", () => {
  const rowHeight = 34;
  const bodyH = 340; // 10 rows
  const totalRows = 100;

  it("leaves scroll alone when the row is already visible", () => {
    expect(scrollTopToRevealRow(3, rowHeight, bodyH, totalRows, 0)).toBe(0);
  });

  it("scrolls down so a below-fold row becomes visible", () => {
    expect(scrollTopToRevealRow(50, rowHeight, bodyH, totalRows, 0)).toBe(
      50 * 34 + 34 - 340,
    );
  });

  it("scrolls up so an above-fold row becomes visible", () => {
    expect(scrollTopToRevealRow(2, rowHeight, bodyH, totalRows, 34 * 20)).toBe(
      2 * 34,
    );
  });
});

describe("viewportBodyHeight", () => {
  it("subtracts the sticky header", () => {
    expect(viewportBodyHeight(400, 52)).toBe(348);
  });
});
