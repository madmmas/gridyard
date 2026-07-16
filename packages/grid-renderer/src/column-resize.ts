//! Column-edge hit testing and width mutation for grid layouts.
//!
//! Gesture wiring lives in the host (web-demo); this module stays pure so
//! layout permissions can gate resize without duplicating geometry math.

import { columnLeft, type GridLayout } from "./layout.js";

/** Half-width of the hit target around a column’s right edge (CSS px). */
export const COLUMN_RESIZE_HIT_SLOP = 4;

/** Minimum allowed data-column width after a resize (CSS px). */
export const MIN_COLUMN_WIDTH = 40;

/**
 * Returns the column whose right edge is within `hitSlop` of `x`, or `null`.
 *
 * By default only the header band (`y < layout.headerHeight`) is active so
 * body clicks keep selecting cells.
 */
export function hitTestColumnResizeEdge(
  layout: GridLayout,
  x: number,
  y: number,
  options?: { hitSlop?: number; headerOnly?: boolean },
): number | null {
  const hitSlop = options?.hitSlop ?? COLUMN_RESIZE_HIT_SLOP;
  const headerOnly = options?.headerOnly ?? true;
  if (headerOnly && (y < 0 || y >= layout.headerHeight)) {
    return null;
  }
  if (x < layout.gutterWidth || x > layout.totalWidth + hitSlop) {
    return null;
  }

  for (let c = 0; c < layout.columnWidths.length; c += 1) {
    const width = layout.columnWidths[c];
    if (width === undefined) {
      continue;
    }
    const right = columnLeft(layout, c) + width;
    if (Math.abs(x - right) <= hitSlop) {
      return c;
    }
  }
  return null;
}

/**
 * Returns a new widths array with `col` set to `nextWidth` (clamped).
 */
export function setColumnWidth(
  widths: readonly number[],
  col: number,
  nextWidth: number,
  minWidth: number = MIN_COLUMN_WIDTH,
): number[] {
  if (col < 0 || col >= widths.length) {
    throw new RangeError(`column ${String(col)} is out of range`);
  }
  const clamped = Math.max(minWidth, nextWidth);
  return widths.map((w, i) => (i === col ? clamped : w));
}

/**
 * Applies a horizontal drag delta to one column.
 */
export function resizeColumnByDelta(
  widths: readonly number[],
  col: number,
  deltaPx: number,
  minWidth: number = MIN_COLUMN_WIDTH,
): number[] {
  const current = widths[col];
  if (current === undefined) {
    throw new RangeError(`column ${String(col)} is out of range`);
  }
  return setColumnWidth(widths, col, current + deltaPx, minWidth);
}

export type ColumnResizeResult =
  | { ok: true; widths: number[] }
  | {
      ok: false;
      reason: "permission-denied" | "invalid-column";
      message: string;
    };

/**
 * Mutates column widths only when `allowed` is true — mirrors
 * {@link commitEditWithAccess} for layout resize.
 */
export function resizeColumnWithPermission(
  widths: readonly number[],
  col: number,
  deltaPx: number,
  allowed: boolean,
  minWidth: number = MIN_COLUMN_WIDTH,
): ColumnResizeResult {
  if (!allowed) {
    return {
      ok: false,
      reason: "permission-denied",
      message: "Cannot resize layout — permission denied.",
    };
  }
  if (col < 0 || col >= widths.length) {
    return {
      ok: false,
      reason: "invalid-column",
      message: `Column ${String(col)} is out of range.`,
    };
  }
  return { ok: true, widths: resizeColumnByDelta(widths, col, deltaPx, minWidth) };
}
