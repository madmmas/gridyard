// Virtualized canvas grid renderer. See docs/02-rendering-layer-spec.md.
//
// Paints fixed-size main / bottom Aggregate regions (ref row, name row,
// row gutter, cell values) from a `gridyard-wasm`-compatible source, with
// selection, keyboard navigation, permission-aware edit/commit, viewport
// row virtualization, rAF paint coalescing, and in-region search highlight.
// Bottom column widths sync from main via `computeBottomLayoutFromMain`.

export { colIndexToLetters, rowIndexToLabel } from "./address.js";
export { formatCellValue } from "./format.js";
export {
  columnLeft,
  columnPositionsMatch,
  computeBottomLayoutFromMain,
  computeGridLayout,
  dataCellRect,
  type GridLayout,
  type GridLayoutInput,
} from "./layout.js";
export {
  GRID_THEME,
  paintStaticGrid,
  type GridRegionChrome,
  type PaintStaticGridOptions,
  type PaintViewport,
} from "./render.js";
export {
  asEditableGrid,
  beginEdit,
  cancelEdit,
  commitEdit,
  commitEditWithAccess,
  formulaBarText,
  updateDraft,
  type CommitEditResult,
  type EditFieldAccess,
  type EditableGrid,
  type EditSession,
} from "./edit.js";
export {
  remapEditableGrid,
  remapGridDataSource,
} from "./column-map.js";
export {
  asRegionDataSource,
  asRegionEditableGrid,
  type RegionWorkspace,
  type WorkspaceRegion,
} from "./region.js";
export {
  addNotesRow,
  createNotesRows,
  updateNotesRow,
  type NotesRow,
} from "./notes.js";
export {
  bottomControlTarget,
  createBottomTabState,
  isBottomTabActive,
  selectBottomTab,
  type BottomTabId,
  type BottomTabState,
} from "./tabs.js";
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

export {
  clampScrollTop,
  scrollTopToRevealRow,
  viewportBodyHeight,
  visibleRowRange,
  type VisibleRowRange,
  type VisibleRowRangeInput,
} from "./viewport.js";
export {
  createPaintScheduler,
  type CreatePaintSchedulerOptions,
  type PaintScheduler,
} from "./paint-batch.js";

export {
  activeSearchMatch,
  beginSearch,
  clearSearch,
  findSearchMatches,
  nextSearchMatch,
  prevSearchMatch,
  scrollTopForSearchMatch,
  type FindMatchesInput,
  type SearchMatch,
  type SearchState,
  type ScrollForSearchInput,
} from "./search.js";
