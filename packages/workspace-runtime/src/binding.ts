/**
 * Transport-agnostic data binding: data object → field → cell.
 *
 * Adapters supply records; these helpers project them onto a
 * {@link WorkspaceLayout} without knowing REST/GraphQL/etc.
 */

import type { LayoutColumn, WorkspaceLayout } from "./types.js";

/** Scalar value suitable for a grid cell after binding. */
export type BoundCellValue = string | number | boolean | null;

/** One data row keyed by layout field id. */
export type BoundRow = Readonly<Record<string, BoundCellValue>>;

/** Main-grid projection aligned with `layout.main.columns`. */
export interface BoundMainGrid {
  dataSource: string;
  /** Row-major cells in column order (matches `layout.main.columns`). */
  cells: BoundCellValue[][];
  /** Same rows as objects keyed by field id. */
  rows: BoundRow[];
}

export type BindingErrorCode = "not_array" | "not_object" | "invalid_path";

export interface BindingError {
  code: BindingErrorCode;
  message: string;
  path?: string;
}

export type BindMainGridResult =
  | { ok: true; grid: BoundMainGrid }
  | { ok: false; error: BindingError };

/**
 * Resolves a dotted binding path on a data object
 * (e.g. `borrower`, `customer.name`).
 */
export function resolveBindingPath(root: unknown, path: string): BoundCellValue {
  if (path.trim() === "") {
    return null;
  }
  const parts = path.split(".");
  let current: unknown = root;
  for (const part of parts) {
    if (!isRecord(current) || !(part in current)) {
      return null;
    }
    current = current[part];
  }
  return toBoundCellValue(current);
}

/**
 * Projects an array of data objects onto the main region of `layout`.
 */
export function bindRecordsToMainGrid(
  records: unknown,
  layout: WorkspaceLayout,
): BindMainGridResult {
  if (!Array.isArray(records)) {
    return {
      ok: false,
      error: {
        code: "not_array",
        message: "collection payload must be a JSON array of data objects",
      },
    };
  }

  const columns = layout.main.columns;
  const rows: BoundRow[] = [];
  const cells: BoundCellValue[][] = [];

  for (let i = 0; i < records.length; i += 1) {
    const record: unknown = records[i];
    if (!isRecord(record)) {
      return {
        ok: false,
        error: {
          code: "not_object",
          message: `record at index ${String(i)} must be a JSON object`,
          path: `[${String(i)}]`,
        },
      };
    }
    const row = bindRecord(record, columns);
    rows.push(row);
    cells.push(columns.map((col) => row[col.fieldId] ?? null));
  }

  return {
    ok: true,
    grid: {
      dataSource: layout.main.dataSource,
      rows,
      cells,
    },
  };
}

function bindRecord(
  record: Record<string, unknown>,
  columns: readonly LayoutColumn[],
): BoundRow {
  const row: Record<string, BoundCellValue> = {};
  for (const column of columns) {
    row[column.fieldId] = resolveBindingPath(record, column.fieldId);
  }
  return row;
}

function toBoundCellValue(value: unknown): BoundCellValue {
  if (value === null || value === undefined) {
    return null;
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  // Nested objects/arrays are not projected into cells yet — stringify
  // so the grid still shows something rather than silently dropping.
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
