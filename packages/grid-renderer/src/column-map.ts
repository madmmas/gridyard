/**
 * Remap paint-column indices onto engine column indices.
 *
 * Used when permissions hide fields: the canvas paints a dense visible
 * column list while the WASM grid keeps the original column layout.
 */

import type { EditableGrid } from "./edit.js";
import type { CellJsValue, GridDataSource } from "./types.js";

/**
 * Wraps a data source so paint col `c` reads engine col `engineColIndices[c]`.
 */
export function remapGridDataSource(
  source: GridDataSource,
  engineColIndices: readonly number[],
): GridDataSource {
  return {
    get_cell(row: number, col: number): CellJsValue {
      const engineCol = engineColIndices[col];
      if (engineCol === undefined) {
        return { type: "empty" };
      }
      return source.get_cell(row, engineCol);
    },
  };
}

/**
 * Same remap for the editable surface (get_input / set_cell included).
 */
export function remapEditableGrid(
  grid: EditableGrid,
  engineColIndices: readonly number[],
): EditableGrid {
  const resolve = (col: number): number | undefined => engineColIndices[col];
  return {
    get_cell(row: number, col: number): CellJsValue {
      const engineCol = resolve(col);
      if (engineCol === undefined) {
        return { type: "empty" };
      }
      return grid.get_cell(row, engineCol);
    },
    get_input(row: number, col: number): string {
      const engineCol = resolve(col);
      if (engineCol === undefined) {
        return "";
      }
      return grid.get_input(row, engineCol);
    },
    set_cell(row: number, col: number, input: string): void {
      const engineCol = resolve(col);
      if (engineCol === undefined) {
        return;
      }
      grid.set_cell(row, engineCol, input);
    },
  };
}
