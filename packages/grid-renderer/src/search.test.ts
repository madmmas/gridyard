import { describe, expect, it } from "vitest";

import {
  activeSearchMatch,
  beginSearch,
  clearSearch,
  findSearchMatches,
  gridFromMatrix,
  nextSearchMatch,
  prevSearchMatch,
  scrollTopForSearchMatch,
} from "./search.js";

describe("findSearchMatches", () => {
  const source = gridFromMatrix([
    ["Alice", "100", "overdue"],
    ["Bob", "200", "current"],
    ["Carol", "150", "overdue"],
  ]);

  it("finds substring matches in row-major order", () => {
    expect(findSearchMatches({ source, rows: 3, cols: 3, query: "over" })).toEqual([
      { row: 0, col: 2 },
      { row: 2, col: 2 },
    ]);
  });

  it("is case-insensitive by default", () => {
    expect(findSearchMatches({ source, rows: 3, cols: 3, query: "BOB" })).toEqual([
      { row: 1, col: 0 },
    ]);
  });

  it("returns no matches for an empty query", () => {
    expect(findSearchMatches({ source, rows: 3, cols: 3, query: "" })).toEqual([]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(
      findSearchMatches({ source, rows: 3, cols: 3, query: "zzz" }),
    ).toEqual([]);
  });
});

describe("next/prev search navigation", () => {
  const source = gridFromMatrix([
    ["a", "x"],
    ["b", "a"],
    ["a", "c"],
  ]);

  it("beginSearch activates the first match", () => {
    const state = beginSearch({ source, rows: 3, cols: 2, query: "a" });
    expect(state.matches).toHaveLength(3);
    expect(state.activeIndex).toBe(0);
    expect(activeSearchMatch(state)).toEqual({ row: 0, col: 0 });
  });

  it("next wraps from last to first", () => {
    let state = beginSearch({ source, rows: 3, cols: 2, query: "a" });
    state = nextSearchMatch(state);
    state = nextSearchMatch(state);
    expect(activeSearchMatch(state)).toEqual({ row: 2, col: 0 });
    state = nextSearchMatch(state);
    expect(activeSearchMatch(state)).toEqual({ row: 0, col: 0 });
  });

  it("prev wraps from first to last", () => {
    let state = beginSearch({ source, rows: 3, cols: 2, query: "a" });
    state = prevSearchMatch(state);
    expect(activeSearchMatch(state)).toEqual({ row: 2, col: 0 });
  });

  it("clearSearch removes matches and active index", () => {
    const state = beginSearch({ source, rows: 3, cols: 2, query: "a" });
    expect(clearSearch()).toEqual({ query: "", matches: [], activeIndex: -1 });
    expect(activeSearchMatch(clearSearch())).toBeNull();
    // original state untouched by clear helper
    expect(state.matches).toHaveLength(3);
  });

  it("next/prev are no-ops with zero matches", () => {
    const empty = beginSearch({ source, rows: 3, cols: 2, query: "" });
    expect(nextSearchMatch(empty)).toEqual(empty);
    expect(prevSearchMatch(empty)).toEqual(empty);
  });
});

describe("scrollTopForSearchMatch", () => {
  it("scrolls far matches into the viewport body", () => {
    const scrollTop = scrollTopForSearchMatch({
      match: { row: 80, col: 0 },
      rowHeight: 34,
      headerHeight: 52,
      viewportHeight: 52 + 340,
      totalRows: 200,
      currentScrollTop: 0,
    });
    expect(scrollTop).toBe(80 * 34 + 34 - 340);
  });
});
