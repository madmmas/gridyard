// Virtualized canvas grid renderer. See docs/02-rendering-layer-spec.md.
//
// Paints a fixed-size main region (ref row, name row, row gutter, cell
// values) from a `gridyard-wasm`-compatible data source, with single-cell
// selection + keyboard navigation helpers.

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
export {
  asEditableGrid,
  beginEdit,
  cancelEdit,
  commitEdit,
  formulaBarText,
  updateDraft,
  type EditableGrid,
  type EditSession,
} from "./edit.js";
export {
  clampSelection,
  hitTestDataCell,
  isSelectionNavKey,
  moveSelection,
  type CellAddress,
  type SelectionBounds,
  type SelectionNavKey,
} from "./selection.js";
export { asGridDataSource } from "./source.js";
export type { CellJsValue, GridDataSource } from "./types.js";
