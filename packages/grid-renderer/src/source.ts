import type { CellJsValue, GridDataSource } from "./types.js";

/**
 * Wraps a `gridyard-wasm` `Grid` (or any `get_cell` object) as a
 * {@link GridDataSource}, normalizing the payload shape.
 */
export function asGridDataSource(grid: {
  get_cell(row: number, col: number): unknown;
}): GridDataSource {
  return {
    get_cell(row: number, col: number): CellJsValue {
      return normalizeCellValue(grid.get_cell(row, col));
    },
  };
}

function normalizeCellValue(raw: unknown): CellJsValue {
  if (typeof raw !== "object" || raw === null || !("type" in raw)) {
    return { type: "empty" };
  }
  const record = raw as Record<string, unknown>;
  const type = record["type"];
  switch (type) {
    case "number":
      return typeof record["value"] === "number"
        ? { type: "number", value: record["value"] }
        : { type: "empty" };
    case "text":
      return typeof record["value"] === "string"
        ? { type: "text", value: record["value"] }
        : { type: "empty" };
    case "bool":
      return typeof record["value"] === "boolean"
        ? { type: "bool", value: record["value"] }
        : { type: "empty" };
    case "empty":
      return { type: "empty" };
    case "error":
      return typeof record["kind"] === "string"
        ? { type: "error", kind: record["kind"] }
        : { type: "error", kind: "Value" };
    case "array":
      return Array.isArray(record["value"])
        ? {
            type: "array",
            value: record["value"].map((item: unknown) => normalizeCellValue(item)),
          }
        : { type: "array", value: [] };
    default:
      return { type: "empty" };
  }
}
