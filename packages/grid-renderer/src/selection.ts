import { columnLeft, type GridLayout } from "./layout.js";

/** Zero-based address of a single active data cell. */
export interface CellAddress {
  row: number;
  col: number;
}

/** Inclusive grid size used to clamp selection (data body only). */
export interface SelectionBounds {
  rows: number;
  cols: number;
}

/** Keys that move the active single-cell selection. */
export type SelectionNavKey =
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight"
  | "Enter"
  | "Tab";

const NAV_KEYS = new Set<string>([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Enter",
  "Tab",
]);

/** Returns true when `key` is a recognized single-cell navigation key. */
export function isSelectionNavKey(key: string): key is SelectionNavKey {
  return NAV_KEYS.has(key);
}

/**
 * Clamps a cell address into the data grid. Empty grids (`rows` or `cols`
 * ≤ 0) have no valid selection — returns `null`.
 */
export function clampSelection(
  address: CellAddress,
  bounds: SelectionBounds,
): CellAddress | null {
  if (bounds.rows <= 0 || bounds.cols <= 0) {
    return null;
  }
  return {
    row: Math.min(Math.max(0, address.row), bounds.rows - 1),
    col: Math.min(Math.max(0, address.col), bounds.cols - 1),
  };
}

/**
 * Moves the active selection by one cell for arrow / Enter / Tab.
 * Stays put at edges (no wrap, no out-of-bounds). When there is no current
 * selection, navigation seeds at A1 (`{ row: 0, col: 0 }`).
 */
export function moveSelection(
  current: CellAddress | null,
  key: SelectionNavKey,
  bounds: SelectionBounds,
): CellAddress | null {
  if (bounds.rows <= 0 || bounds.cols <= 0) {
    return null;
  }

  const base = current ?? { row: 0, col: 0 };
  let row = base.row;
  let col = base.col;

  switch (key) {
    case "ArrowUp":
      row -= 1;
      break;
    case "ArrowDown":
    case "Enter":
      row += 1;
      break;
    case "ArrowLeft":
      col -= 1;
      break;
    case "ArrowRight":
    case "Tab":
      col += 1;
      break;
  }

  return clampSelection({ row, col }, bounds);
}

/**
 * Maps a canvas-local point to a data cell, or `null` when the point lands
 * on the ref/name header, the row gutter, or outside the body.
 *
 * When the grid is virtually scrolled, pass the same `scrollTop` used for
 * paint so viewport-local `y` maps back to content row indices.
 */
export function hitTestDataCell(
  layout: GridLayout,
  x: number,
  y: number,
  bounds: SelectionBounds,
  scrollTop = 0,
): CellAddress | null {
  if (bounds.rows <= 0 || bounds.cols <= 0) {
    return null;
  }
  if (x < layout.gutterWidth || y < layout.headerHeight) {
    return null;
  }
  if (x >= layout.totalWidth) {
    return null;
  }

  const contentY = y + Math.max(0, scrollTop);
  if (contentY >= layout.totalHeight) {
    return null;
  }

  const row = Math.floor((contentY - layout.headerHeight) / layout.rowHeight);
  if (row < 0 || row >= bounds.rows) {
    return null;
  }

  let col = -1;
  for (let c = 0; c < bounds.cols; c += 1) {
    const left = columnLeft(layout, c);
    const width = layout.columnWidths[c] ?? 0;
    if (x >= left && x < left + width) {
      col = c;
      break;
    }
  }
  if (col < 0) {
    return null;
  }

  return { row, col };
}
