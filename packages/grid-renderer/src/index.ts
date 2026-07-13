// Virtualized canvas grid renderer. See docs/02-rendering-layer-spec.md.
//
// This first slice paints a fixed-size main region (ref row, name row,
// row gutter, cell values) from a `gridyard-wasm`-compatible data source.

export { colIndexToLetters, rowIndexToLabel } from "./address.js";
export { formatCellValue } from "./format.js";
export {
  columnLeft,
  computeGridLayout,
  dataCellRect,
  type GridLayout,
  type GridLayoutInput,
} from "./layout.js";
export { GRID_THEME, paintStaticGrid, type PaintStaticGridOptions } from "./render.js";
export { asGridDataSource } from "./source.js";
export type { CellJsValue, GridDataSource } from "./types.js";
