/**
 * Demo glue around grid-renderer search helpers: status text and scrolling
 * the active match into the main scroll host.
 */

import {
  activeSearchMatch,
  scrollTopForSearchMatch,
  type GridLayout,
  type SearchState,
} from "@gridyard/grid-renderer";

/** Human-readable match counter for the search chrome (e.g. "2 of 5"). */
export function formatSearchStatus(state: SearchState): string {
  if (state.query.length === 0) {
    return "";
  }
  if (state.matches.length === 0) {
    return "no matches";
  }
  return `${String(state.activeIndex + 1)} of ${String(state.matches.length)}`;
}

export interface RevealSearchMatchInput {
  host: Pick<HTMLElement, "scrollTop" | "clientHeight">;
  layout: Pick<GridLayout, "rowHeight" | "headerHeight">;
  state: SearchState;
  totalRows: number;
}

/**
 * Scrolls the host so the active search match is visible.
 * No-op when there is no active match.
 * Returns the scrollTop applied (or the current one when unchanged/noop).
 */
export function revealActiveSearchMatch(input: RevealSearchMatchInput): number {
  const match = activeSearchMatch(input.state);
  if (match === null) {
    return input.host.scrollTop;
  }
  const next = scrollTopForSearchMatch({
    match,
    rowHeight: input.layout.rowHeight,
    headerHeight: input.layout.headerHeight,
    viewportHeight: input.host.clientHeight,
    totalRows: input.totalRows,
    currentScrollTop: input.host.scrollTop,
  });
  if (next !== input.host.scrollTop) {
    input.host.scrollTop = next;
  }
  return next;
}
