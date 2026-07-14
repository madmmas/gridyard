/**
 * Demo glue: project a bound main grid + layout onto renderer paint options
 * and WASM `set_cell` inputs.
 */

import type {
  BoundCellValue,
  BoundMainGrid,
  WorkspaceLayout,
} from "@gridyard/workspace-runtime";

/** Minimal grid write surface (WASM Grid / EditableGrid). */
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
