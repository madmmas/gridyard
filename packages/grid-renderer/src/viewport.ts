/** Inclusive start / exclusive end of data rows intersecting the viewport. */
export interface VisibleRowRange {
  startRow: number;
  endRow: number;
}

/** Inputs for mapping a vertical scroll position to painted data rows. */
export interface VisibleRowRangeInput {
  /** Vertical scroll offset of the body (pixels below the sticky header). */
  scrollTop: number;
  /** Full paint surface height including sticky header chrome. */
  viewportHeight: number;
  /** Sticky ref+name header height (body starts below this). */
  headerHeight: number;
  rowHeight: number;
  totalRows: number;
  /** Extra rows painted above/below the strict window (default 0). */
  overscan?: number;
}

/**
 * Computes which data rows intersect the visible viewport.
 *
 * Pure layout math — does not touch engine state. Rows outside the returned
 * range are skipped at paint time only; their values stay correct when
 * scrolled into view.
 */
export function visibleRowRange(input: VisibleRowRangeInput): VisibleRowRange {
  const {
    scrollTop,
    viewportHeight,
    headerHeight,
    rowHeight,
    totalRows,
  } = input;
  const overscan = input.overscan ?? 0;

  if (totalRows <= 0 || rowHeight <= 0) {
    return { startRow: 0, endRow: 0 };
  }

  const bodyHeight = Math.max(0, viewportHeight - headerHeight);
  if (bodyHeight <= 0) {
    return { startRow: 0, endRow: 0 };
  }

  const clampedScroll = Math.max(0, scrollTop);
  const first = Math.floor(clampedScroll / rowHeight);
  if (first >= totalRows) {
    return { startRow: totalRows, endRow: totalRows };
  }
  // +1 covers a partially-visible trailing row at the bottom edge.
  const visibleCount = Math.ceil(bodyHeight / rowHeight) + 1;
  const startRow = Math.max(0, first - overscan);
  const endRow = Math.min(totalRows, first + visibleCount + overscan);
  return { startRow, endRow };
}

/**
 * Clamps `scrollTop` so the body cannot scroll past the last row.
 */
export function clampScrollTop(
  scrollTop: number,
  totalRows: number,
  rowHeight: number,
  viewportBodyHeight: number,
): number {
  const contentBody = Math.max(0, totalRows) * Math.max(0, rowHeight);
  const maxScroll = Math.max(0, contentBody - Math.max(0, viewportBodyHeight));
  return Math.min(Math.max(0, scrollTop), maxScroll);
}

/**
 * Returns a scrollTop that makes `row` fully visible in the body viewport.
 * If the row is already fully visible, returns `currentScrollTop` unchanged.
 */
export function scrollTopToRevealRow(
  row: number,
  rowHeight: number,
  viewportBodyHeight: number,
  totalRows: number,
  currentScrollTop: number,
): number {
  if (totalRows <= 0 || rowHeight <= 0 || viewportBodyHeight <= 0) {
    return 0;
  }

  const clampedRow = Math.min(Math.max(0, row), totalRows - 1);
  const rowTop = clampedRow * rowHeight;
  const rowBottom = rowTop + rowHeight;
  const viewTop = Math.max(0, currentScrollTop);
  const viewBottom = viewTop + viewportBodyHeight;

  let next = viewTop;
  if (rowTop < viewTop) {
    next = rowTop;
  } else if (rowBottom > viewBottom) {
    next = rowBottom - viewportBodyHeight;
  }

  return clampScrollTop(next, totalRows, rowHeight, viewportBodyHeight);
}

/** Height of the scrollable body area inside a paint viewport. */
export function viewportBodyHeight(
  viewportHeight: number,
  headerHeight: number,
): number {
  return Math.max(0, viewportHeight - headerHeight);
}
