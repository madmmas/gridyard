import { describe, expect, it } from "vitest";

import {
  beginSearch,
  clearSearch,
  type CellJsValue,
  type GridDataSource,
} from "@gridyard/grid-renderer";

import {
  formatSearchStatus,
  revealActiveSearchMatch,
} from "./search-chrome.js";

function textGrid(cells: ReadonlyArray<ReadonlyArray<string>>): GridDataSource {
  return {
    get_cell(row: number, col: number): CellJsValue {
      const value = cells[row]?.[col];
      if (value === undefined || value === "") {
        return { type: "empty" };
      }
      return { type: "text", value };
    },
  };
}

describe("formatSearchStatus", () => {
  it("returns empty for a cleared query", () => {
    expect(formatSearchStatus(clearSearch())).toBe("");
  });

  it("reports no matches when the query hits nothing", () => {
    const state = beginSearch({
      source: textGrid([["a"]]),
      rows: 1,
      cols: 1,
      query: "zzz",
    });
    expect(formatSearchStatus(state)).toBe("no matches");
  });

  it("shows 1-based active index and total", () => {
    const state = beginSearch({
      source: textGrid([["a"], ["a"], ["a"]]),
      rows: 3,
      cols: 1,
      query: "a",
    });
    expect(formatSearchStatus(state)).toBe("1 of 3");
  });
});

describe("revealActiveSearchMatch", () => {
  it("scrolls so a far match is visible and is a no-op without matches", () => {
    const host = { scrollTop: 0, clientHeight: 52 + 340 };
    const layout = { rowHeight: 34, headerHeight: 52 };
    const cells = Array.from({ length: 100 }, () => ["x"]);
    cells[80] = ["hit"];
    const state = beginSearch({
      source: textGrid(cells),
      rows: 100,
      cols: 1,
      query: "hit",
    });
    const next = revealActiveSearchMatch({
      host,
      layout,
      state,
      totalRows: 100,
    });
    expect(next).toBe(80 * 34 + 34 - 340);
    expect(host.scrollTop).toBe(next);

    const empty = beginSearch({
      source: textGrid([["x"]]),
      rows: 1,
      cols: 1,
      query: "",
    });
    host.scrollTop = 12;
    expect(
      revealActiveSearchMatch({
        host,
        layout,
        state: empty,
        totalRows: 100,
      }),
    ).toBe(12);
    expect(host.scrollTop).toBe(12);
  });
});
