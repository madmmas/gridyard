/** Cell value shape returned by `gridyard-wasm` `get_cell`. */
export type CellJsValue =
  | { type: "number"; value: number }
  | { type: "text"; value: string }
  | { type: "bool"; value: boolean }
  | { type: "empty" }
  | { type: "error"; kind: string }
  | { type: "array"; value: CellJsValue[] };

/**
 * Read-only data source matching the `gridyard-wasm` `Grid.get_cell` API.
 * Row and column are zero-based (A1 → row 0, col 0).
 */
export interface GridDataSource {
  get_cell(row: number, col: number): CellJsValue;
}
