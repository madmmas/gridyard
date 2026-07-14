/**
 * Demo glue: project a bound main grid + layout onto renderer paint options
 * and WASM `set_cell` inputs.
 */

import type {
  BoundCellValue,
  BoundMainGrid,
  WorkspaceLayout,
} from "@gridyard/workspace-runtime";
import { colIndexToLetters } from "@gridyard/grid-renderer";

/** Minimal grid write surface (WASM Grid / region EditableGrid). */
export interface CellWriter {
  set_cell(row: number, col: number, input: string): void;
}

export interface MainRegionPaintConfig {
  rows: number;
  cols: number;
  columnNames: string[];
  columnWidths: number[];
  numericColumns: Set<number>;
}

/** Formats a bound scalar for `set_cell` / the formula bar. */
export function boundValueToInput(value: BoundCellValue): string {
  if (value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  if (Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

/**
 * Writes every bound cell into `grid` in column order.
 * Returns the sheet dimensions used for selection/paint.
 */
export function seedGridFromBoundMain(
  grid: CellWriter,
  bound: BoundMainGrid,
): { rows: number; cols: number } {
  const cols =
    bound.cells.reduce((max, row) => Math.max(max, row.length), 0) ||
    (bound.rows[0] === undefined ? 0 : Object.keys(bound.rows[0]).length);
  const rows = bound.cells.length;

  for (let r = 0; r < rows; r += 1) {
    const row = bound.cells[r] ?? [];
    for (let c = 0; c < cols; c += 1) {
      grid.set_cell(r, c, boundValueToInput(row[c] ?? null));
    }
  }

  return { rows, cols };
}

/**
 * Seeds bottom Aggregate with Total / Average label rows and `main!`
 * formulas over the currency / number columns (mockup-shaped).
 */
export function seedBottomAggregate(
  grid: CellWriter,
  mainRows: number,
  cols: number,
  numericColumns: ReadonlySet<number>,
): { rows: number; cols: number } {
  const lastMainRow = Math.max(mainRows, 1);
  const rangeEnd = String(lastMainRow);

  grid.set_cell(0, 0, `Total (${String(mainRows)})`);
  grid.set_cell(1, 0, "Average");

  for (let c = 1; c < cols; c += 1) {
    if (!numericColumns.has(c)) {
      grid.set_cell(0, c, "—");
      grid.set_cell(1, c, "—");
      continue;
    }
    const letters = colIndexToLetters(c);
    const range = `main!${letters}1:${letters}${rangeEnd}`;
    grid.set_cell(0, c, `=SUM(${range})`);
    grid.set_cell(1, c, `=AVERAGE(${range})`);
  }

  return { rows: 2, cols };
}

/** Paint options for the main region derived from the workspace layout. */
export function paintConfigFromLayout(
  layout: WorkspaceLayout,
  rowCount: number,
): MainRegionPaintConfig {
  const columns = layout.main.columns;
  const numericColumns = new Set<number>();
  const columnNames: string[] = [];
  const columnWidths: number[] = [];

  for (const column of columns) {
    columnNames.push(column.name);
    columnWidths.push(defaultColumnWidth(column.type));
    if (column.type === "number" || column.type === "currency") {
      numericColumns.add(column.colIndex);
    }
  }

  return {
    rows: rowCount,
    cols: columns.length,
    columnNames,
    columnWidths,
    numericColumns,
  };
}

function defaultColumnWidth(
  type: WorkspaceLayout["main"]["columns"][number]["type"],
): number {
  switch (type) {
    case "currency":
    case "number":
      return 90;
    case "status":
    case "boolean":
      return 96;
    case "text":
    default:
      return 168;
  }
}
