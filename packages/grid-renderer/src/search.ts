import { formatCellValue } from "./format.js";
import type { CellAddress } from "./selection.js";
import type { CellJsValue, GridDataSource } from "./types.js";
import {
  clampScrollTop,
  scrollTopToRevealRow,
  viewportBodyHeight,
} from "./viewport.js";

/** One search hit within a single active region/tab. */
export interface SearchMatch {
  row: number;
  col: number;
}

/** Result of finding matches plus navigable index state. */
export interface SearchState {
  query: string;
  matches: SearchMatch[];
  /** Index into `matches`, or -1 when there are no matches. */
  activeIndex: number;
}

export interface FindMatchesInput {
  source: GridDataSource;
  rows: number;
  cols: number;
  /** Literal/substring query; empty clears matches. */
  query: string;
  /** Case-insensitive when true (default true). */
  caseInsensitive?: boolean;
}

/**
 * Scans displayed cell values in the active region for a literal substring.
 *
 * Matches the painted/formatted value (not formula source). Empty query
 * yields no matches. Out of scope: regex, fuzzy, cross-region search.
 */
export function findSearchMatches(input: FindMatchesInput): SearchMatch[] {
  const raw = input.query;
  if (raw.length === 0) {
    return [];
  }
  const caseInsensitive = input.caseInsensitive ?? true;
  const needle = caseInsensitive ? raw.toLowerCase() : raw;
  const matches: SearchMatch[] = [];

  for (let row = 0; row < input.rows; row += 1) {
    for (let col = 0; col < input.cols; col += 1) {
      const text = formatCellValue(input.source.get_cell(row, col));
      const haystack = caseInsensitive ? text.toLowerCase() : text;
      if (haystack.includes(needle)) {
        matches.push({ row, col });
      }
    }
  }
  return matches;
}

/**
 * Builds search state for a new query, activating the first match when any.
 */
export function beginSearch(input: FindMatchesInput): SearchState {
  const matches = findSearchMatches(input);
  return {
    query: input.query,
    matches,
    activeIndex: matches.length === 0 ? -1 : 0,
  };
}

/** Clears highlights and query. */
export function clearSearch(): SearchState {
  return { query: "", matches: [], activeIndex: -1 };
}

/**
 * Advances to the next match, wrapping from last → first.
 * No-op (returns same state) when there are no matches.
 */
export function nextSearchMatch(state: SearchState): SearchState {
  if (state.matches.length === 0) {
    return state;
  }
  const activeIndex = (state.activeIndex + 1) % state.matches.length;
  return { ...state, activeIndex };
}

/**
 * Moves to the previous match, wrapping from first → last.
 */
export function prevSearchMatch(state: SearchState): SearchState {
  if (state.matches.length === 0) {
    return state;
  }
  const activeIndex =
    (state.activeIndex - 1 + state.matches.length) % state.matches.length;
  return { ...state, activeIndex };
}

/** Active match address, or `null` when none. */
export function activeSearchMatch(state: SearchState): CellAddress | null {
  if (state.activeIndex < 0 || state.activeIndex >= state.matches.length) {
    return null;
  }
  const match = state.matches[state.activeIndex];
  if (match === undefined) {
    return null;
  }
  return { row: match.row, col: match.col };
}

export interface ScrollForSearchInput {
  match: CellAddress;
  rowHeight: number;
  headerHeight: number;
  viewportHeight: number;
  totalRows: number;
  currentScrollTop: number;
}

/**
 * Scroll offset that reveals the active search match (uses §22 viewport math).
 */
export function scrollTopForSearchMatch(input: ScrollForSearchInput): number {
  const bodyH = viewportBodyHeight(input.viewportHeight, input.headerHeight);
  return scrollTopToRevealRow(
    input.match.row,
    input.rowHeight,
    bodyH,
    input.totalRows,
    clampScrollTop(
      input.currentScrollTop,
      input.totalRows,
      input.rowHeight,
      bodyH,
    ),
  );
}

/** Test helper: build an in-memory text grid. */
export function gridFromMatrix(
  cells: ReadonlyArray<ReadonlyArray<string>>,
): GridDataSource {
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
