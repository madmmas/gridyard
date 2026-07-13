import type { CellJsValue } from "./types.js";

/**
 * Formats a WASM cell payload for display in a grid cell.
 */
export function formatCellValue(value: CellJsValue): string {
  switch (value.type) {
    case "empty":
      return "";
    case "number":
      return formatNumber(value.value);
    case "text":
      return value.value;
    case "bool":
      return value.value ? "TRUE" : "FALSE";
    case "error":
      return `#${value.kind.toUpperCase()}!`;
    case "array":
      return value.value.map(formatCellValue).join(", ");
  }
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) {
    return String(n);
  }
  return String(n);
}
