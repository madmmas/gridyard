/** Dimensions for a fixed-size main-region spreadsheet chrome. */
export interface GridLayoutInput {
  rows: number;
  cols: number;
  /** Per-column widths in CSS pixels; defaults apply when omitted/short. */
  columnWidths?: readonly number[];
  gutterWidth?: number;
  refRowHeight?: number;
  nameRowHeight?: number;
  rowHeight?: number;
  defaultColumnWidth?: number;
}

/** Resolved pixel layout for painting. */
export interface GridLayout {
  gutterWidth: number;
  refRowHeight: number;
  nameRowHeight: number;
  rowHeight: number;
  columnWidths: number[];
  headerHeight: number;
  bodyHeight: number;
  totalWidth: number;
  totalHeight: number;
}

const DEFAULT_GUTTER = 26;
const DEFAULT_REF_ROW = 22;
const DEFAULT_NAME_ROW = 30;
const DEFAULT_ROW = 34;
const DEFAULT_COL = 100;

/**
 * Computes pixel sizes matching the main panel chrome in
 * `docs/workspace-ui-mockup.html` (ref row + name row + gutter).
 */
export function computeGridLayout(input: GridLayoutInput): GridLayout {
  if (input.rows < 0 || input.cols < 0) {
    throw new RangeError("rows and cols must be non-negative");
  }

  const gutterWidth = input.gutterWidth ?? DEFAULT_GUTTER;
  const refRowHeight = input.refRowHeight ?? DEFAULT_REF_ROW;
  const nameRowHeight = input.nameRowHeight ?? DEFAULT_NAME_ROW;
  const rowHeight = input.rowHeight ?? DEFAULT_ROW;
  const defaultColumnWidth = input.defaultColumnWidth ?? DEFAULT_COL;

  const columnWidths: number[] = [];
  for (let c = 0; c < input.cols; c += 1) {
    columnWidths.push(input.columnWidths?.[c] ?? defaultColumnWidth);
  }

  const bodyWidth = columnWidths.reduce((sum, w) => sum + w, 0);
  const headerHeight = refRowHeight + nameRowHeight;
  const bodyHeight = input.rows * rowHeight;

  return {
    gutterWidth,
    refRowHeight,
    nameRowHeight,
    rowHeight,
    columnWidths,
    headerHeight,
    bodyHeight,
    totalWidth: gutterWidth + bodyWidth,
    totalHeight: headerHeight + bodyHeight,
  };
}

/** Left edge (x) of data column `col` within the full grid. */
export function columnLeft(layout: GridLayout, col: number): number {
  let x = layout.gutterWidth;
  for (let c = 0; c < col; c += 1) {
    const width = layout.columnWidths[c];
    if (width === undefined) {
      throw new RangeError(`column ${String(col)} is out of range`);
    }
    x += width;
  }
  return x;
}

/** Top-left and size of a data cell (not header/gutter). */
export function dataCellRect(
  layout: GridLayout,
  row: number,
  col: number,
): { x: number; y: number; width: number; height: number } {
  const width = layout.columnWidths[col];
  if (width === undefined) {
    throw new RangeError(`column ${String(col)} is out of range`);
  }
  return {
    x: columnLeft(layout, col),
    y: layout.headerHeight + row * layout.rowHeight,
    width,
    height: layout.rowHeight,
  };
}
