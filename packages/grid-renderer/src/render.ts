import { colIndexToLetters, rowIndexToLabel } from "./address.js";
import { formatCellValue } from "./format.js";
import {
  columnLeft,
  computeGridLayout,
  dataCellRect,
  type GridLayout,
  type GridLayoutInput,
} from "./layout.js";
import type { CellAddress } from "./selection.js";
import type { GridDataSource } from "./types.js";
import {
  visibleRowRange,
  type VisibleRowRange,
} from "./viewport.js";

/** Colors aligned with `docs/workspace-ui-mockup.html`. */
export const GRID_THEME = {
  textPrimary: "#101014",
  textSecondary: "#52525b",
  textMuted: "#8b8b93",
  border: "#e4e4e7",
  surface0: "#ffffff",
  surface1: "#f4f4f5",
  /** Softer fill for the bottom Aggregate region body (visually distinct). */
  surfaceBottom: "#fafafa",
  /** Active selection fill (`--bg-accent` in the mockup). */
  selectionFill: "#e6f1fb",
  /** Active selection border (`--fill-accent` in the mockup). */
  selectionBorder: "#378add",
  /** Error cell text (`--text-danger` in the mockup). */
  textDanger: "#791f1f",
  /** Search-match cell fill. */
  searchMatchFill: "#fef3c7",
  /** Active (focused) search-match border. */
  searchActiveBorder: "#d97706",
} as const;

export type GridRegionChrome = "main" | "bottom";

/**
 * Viewport window for virtualized painting. When set, only intersecting
 * rows are painted; canvas should be sized to `height` × full content width.
 * Omit to paint the entire sheet (small grids / tests).
 *
 * Horizontal virtualization is intentionally skipped — current workspaces
 * use a handful of columns and do not need it yet.
 */
export interface PaintViewport {
  /** Vertical scroll offset of the body (pixels below the sticky header). */
  scrollTop: number;
  /** Paint surface height including sticky header chrome. */
  height: number;
  /** Extra rows above/below the strict window (default 2). */
  overscan?: number;
}

export interface PaintStaticGridOptions extends GridLayoutInput {
  /** Human-readable field names for the name row (one per column). */
  columnNames: readonly string[];
  /** Live grid data — typically a `gridyard-wasm` `Grid` or region adapter. */
  source: GridDataSource;
  /** Columns whose values should be right-aligned (like mockup `.num`). */
  numericColumns?: ReadonlySet<number>;
  /** Single active cell to highlight; omit or `null` for none. */
  selection?: CellAddress | null;
  /**
   * Visual chrome variant. `bottom` uses a distinct body background so the
   * Aggregate region never reads as a merged frozen pane with main.
   */
  chrome?: GridRegionChrome;
  /**
   * When set, paints only the visible row window (virtual rendering).
   * Headers stay fixed; body cells are offset by `-scrollTop`.
   */
  viewport?: PaintViewport;
  /** Cells matching an active search (literal/substring); painted with highlight. */
  searchMatches?: readonly CellAddress[];
  /** The focused search match (next/prev); stronger border than other matches. */
  activeSearchMatch?: CellAddress | null;
}

/**
 * Paints a main/bottom Aggregate grid onto `ctx`: ref row, name row,
 * row gutter, and cell values from `source.get_cell`.
 *
 * With `viewport`, only visible rows are painted — engine state is untouched.
 * Returns the full content layout (useful for scroll content sizing / hit-test).
 */
export function paintStaticGrid(
  ctx: CanvasRenderingContext2D,
  options: PaintStaticGridOptions,
): GridLayout {
  const layout = computeGridLayout(options);
  const { rows, cols, columnNames, source, numericColumns, selection } = options;
  const chrome = options.chrome ?? "main";
  const bodyFill = chrome === "bottom" ? GRID_THEME.surfaceBottom : GRID_THEME.surface0;
  const paintH = options.viewport?.height ?? layout.totalHeight;
  const scrollTop = options.viewport?.scrollTop ?? 0;
  const rowWindow = resolveRowWindow(layout, rows, options.viewport);

  ctx.save();
  ctx.clearRect(0, 0, layout.totalWidth, paintH);
  ctx.fillStyle = bodyFill;
  ctx.fillRect(0, 0, layout.totalWidth, paintH);

  // Body layer is clipped below the sticky header so scrolled rows never paint
  // through ref/name chrome (selection, gutter labels, cell text, etc.).
  ctx.save();
  ctx.beginPath();
  ctx.rect(
    0,
    layout.headerHeight,
    layout.totalWidth,
    Math.max(0, paintH - layout.headerHeight),
  );
  ctx.clip();
  paintGutterBackground(ctx, layout, paintH);
  paintGutter(ctx, layout, rowWindow, scrollTop);
  paintSearchHighlights(
    ctx,
    layout,
    rows,
    cols,
    rowWindow,
    scrollTop,
    options.searchMatches ?? [],
    options.activeSearchMatch ?? null,
  );
  paintSelectionFill(ctx, layout, rows, cols, rowWindow, scrollTop, selection ?? null);
  paintBody(
    ctx,
    layout,
    cols,
    rowWindow,
    scrollTop,
    source,
    numericColumns ?? new Set(),
  );
  paintBodyGridLines(ctx, layout, rows, cols, rowWindow, scrollTop, paintH);
  paintSelectionBorder(ctx, layout, rows, cols, rowWindow, scrollTop, selection ?? null);
  paintActiveSearchBorder(
    ctx,
    layout,
    rows,
    cols,
    rowWindow,
    scrollTop,
    options.activeSearchMatch ?? null,
  );
  ctx.restore();

  // Sticky header chrome last so it stays readable above any clipped body.
  paintHeaderBackground(ctx, layout);
  paintRefRow(ctx, layout, cols);
  paintNameRow(ctx, layout, columnNames);
  paintHeaderGridLines(ctx, layout, cols, paintH);

  // Outer border so each region reads as its own panel, not a shared pane.
  ctx.strokeStyle = GRID_THEME.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, layout.totalWidth - 1, paintH - 1);

  ctx.restore();
  return layout;
}

function resolveRowWindow(
  layout: GridLayout,
  rows: number,
  viewport: PaintViewport | undefined,
): VisibleRowRange {
  if (viewport === undefined) {
    return { startRow: 0, endRow: rows };
  }
  return visibleRowRange({
    scrollTop: viewport.scrollTop,
    viewportHeight: viewport.height,
    headerHeight: layout.headerHeight,
    rowHeight: layout.rowHeight,
    totalRows: rows,
    overscan: viewport.overscan ?? 2,
  });
}

function selectionInBounds(
  selection: CellAddress | null,
  rows: number,
  cols: number,
): CellAddress | null {
  if (selection === null) {
    return null;
  }
  if (
    selection.row < 0 ||
    selection.col < 0 ||
    selection.row >= rows ||
    selection.col >= cols
  ) {
    return null;
  }
  return selection;
}

function rowInWindow(row: number, window: VisibleRowRange): boolean {
  return row >= window.startRow && row < window.endRow;
}

function paintSelectionFill(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
  rows: number,
  cols: number,
  rowWindow: VisibleRowRange,
  scrollTop: number,
  selection: CellAddress | null,
): void {
  const active = selectionInBounds(selection, rows, cols);
  if (active === null || !rowInWindow(active.row, rowWindow)) {
    return;
  }
  const rect = dataCellRect(layout, active.row, active.col);
  ctx.fillStyle = GRID_THEME.selectionFill;
  ctx.fillRect(rect.x, rect.y - scrollTop, rect.width, rect.height);
}

function paintSelectionBorder(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
  rows: number,
  cols: number,
  rowWindow: VisibleRowRange,
  scrollTop: number,
  selection: CellAddress | null,
): void {
  const active = selectionInBounds(selection, rows, cols);
  if (active === null || !rowInWindow(active.row, rowWindow)) {
    return;
  }
  const rect = dataCellRect(layout, active.row, active.col);
  ctx.strokeStyle = GRID_THEME.selectionBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(
    rect.x + 1,
    rect.y - scrollTop + 1,
    rect.width - 2,
    rect.height - 2,
  );
}

function paintSearchHighlights(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
  rows: number,
  cols: number,
  rowWindow: VisibleRowRange,
  scrollTop: number,
  matches: readonly CellAddress[],
  active: CellAddress | null,
): void {
  ctx.fillStyle = GRID_THEME.searchMatchFill;
  for (const match of matches) {
    if (!selectionInBounds(match, rows, cols)) {
      continue;
    }
    if (!rowInWindow(match.row, rowWindow)) {
      continue;
    }
    if (
      active !== null &&
      active.row === match.row &&
      active.col === match.col
    ) {
      continue; // active gets its own stronger stroke after fill
    }
    const rect = dataCellRect(layout, match.row, match.col);
    ctx.fillRect(rect.x, rect.y - scrollTop, rect.width, rect.height);
  }
  if (active !== null && selectionInBounds(active, rows, cols)) {
    if (rowInWindow(active.row, rowWindow)) {
      const rect = dataCellRect(layout, active.row, active.col);
      ctx.fillStyle = GRID_THEME.searchMatchFill;
      ctx.fillRect(rect.x, rect.y - scrollTop, rect.width, rect.height);
    }
  }
}

function paintActiveSearchBorder(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
  rows: number,
  cols: number,
  rowWindow: VisibleRowRange,
  scrollTop: number,
  active: CellAddress | null,
): void {
  const cell = selectionInBounds(active, rows, cols);
  if (cell === null || !rowInWindow(cell.row, rowWindow)) {
    return;
  }
  const rect = dataCellRect(layout, cell.row, cell.col);
  ctx.strokeStyle = GRID_THEME.searchActiveBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(
    rect.x + 1,
    rect.y - scrollTop + 1,
    rect.width - 2,
    rect.height - 2,
  );
}

function paintHeaderBackground(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
): void {
  ctx.fillStyle = GRID_THEME.surface1;
  ctx.fillRect(0, 0, layout.totalWidth, layout.headerHeight);
}

function paintGutterBackground(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
  paintH: number,
): void {
  ctx.fillStyle = GRID_THEME.surface1;
  ctx.fillRect(
    0,
    layout.headerHeight,
    layout.gutterWidth,
    Math.max(0, paintH - layout.headerHeight),
  );
}

function paintRefRow(ctx: CanvasRenderingContext2D, layout: GridLayout, cols: number): void {
  ctx.fillStyle = GRID_THEME.textMuted;
  ctx.font = "500 12px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let c = 0; c < cols; c += 1) {
    const width = layout.columnWidths[c] ?? 0;
    const x = columnLeft(layout, c) + width / 2;
    const y = layout.refRowHeight / 2;
    ctx.fillText(colIndexToLetters(c), x, y);
  }
}

function paintNameRow(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
  columnNames: readonly string[],
): void {
  ctx.fillStyle = GRID_THEME.textSecondary;
  ctx.font = "500 13px ui-sans-serif, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  const y = layout.refRowHeight + layout.nameRowHeight / 2;
  for (let c = 0; c < layout.columnWidths.length; c += 1) {
    const width = layout.columnWidths[c] ?? 0;
    const name = columnNames[c] ?? "";
    const x = columnLeft(layout, c);
    ctx.textAlign = "left";
    ctx.fillText(name, x + 10, y, width - 16);
  }
}

function paintGutter(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
  rowWindow: VisibleRowRange,
  scrollTop: number,
): void {
  ctx.fillStyle = GRID_THEME.textMuted;
  ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let r = rowWindow.startRow; r < rowWindow.endRow; r += 1) {
    const y =
      layout.headerHeight + r * layout.rowHeight + layout.rowHeight / 2 - scrollTop;
    ctx.fillText(rowIndexToLabel(r), layout.gutterWidth / 2, y);
  }
}

function paintBody(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
  cols: number,
  rowWindow: VisibleRowRange,
  scrollTop: number,
  source: GridDataSource,
  numericColumns: ReadonlySet<number>,
): void {
  ctx.font = "13px ui-sans-serif, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  for (let r = rowWindow.startRow; r < rowWindow.endRow; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const rect = dataCellRect(layout, r, c);
      const value = source.get_cell(r, c);
      const text = formatCellValue(value);
      const y = rect.y - scrollTop + rect.height / 2;
      ctx.fillStyle =
        value.type === "error" ? GRID_THEME.textDanger : GRID_THEME.textPrimary;
      if (numericColumns.has(c) && value.type !== "error") {
        ctx.textAlign = "right";
        ctx.fillText(text, rect.x + rect.width - 10, y, rect.width - 16);
      } else {
        ctx.textAlign = "left";
        ctx.fillText(text, rect.x + 10, y, rect.width - 16);
      }
    }
  }
}

function paintBodyGridLines(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
  rows: number,
  cols: number,
  rowWindow: VisibleRowRange,
  scrollTop: number,
  paintH: number,
): void {
  ctx.strokeStyle = GRID_THEME.border;
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let r = rowWindow.startRow; r <= rowWindow.endRow; r += 1) {
    if (r < 0 || r > rows) {
      continue;
    }
    const yy = layout.headerHeight + r * layout.rowHeight - scrollTop;
    if (yy < layout.headerHeight - 1 || yy > paintH + 1) {
      continue;
    }
    ctx.moveTo(0, yy + 0.5);
    ctx.lineTo(layout.totalWidth, yy + 0.5);
  }

  // Verticals only in the body clip region (header redraws its own segment).
  ctx.moveTo(layout.gutterWidth + 0.5, layout.headerHeight);
  ctx.lineTo(layout.gutterWidth + 0.5, paintH);
  for (let c = 0; c < cols; c += 1) {
    const width = layout.columnWidths[c] ?? 0;
    const x = columnLeft(layout, c) + width;
    ctx.moveTo(x + 0.5, layout.headerHeight);
    ctx.lineTo(x + 0.5, paintH);
  }

  ctx.stroke();
}

/** Separator + vertical lines for the sticky ref/name header band. */
function paintHeaderGridLines(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
  cols: number,
  paintH: number,
): void {
  ctx.strokeStyle = GRID_THEME.border;
  ctx.lineWidth = 1;
  ctx.beginPath();

  let y = layout.refRowHeight;
  ctx.moveTo(0, y + 0.5);
  ctx.lineTo(layout.totalWidth, y + 0.5);
  y = layout.headerHeight;
  ctx.moveTo(0, y + 0.5);
  ctx.lineTo(layout.totalWidth, y + 0.5);

  ctx.moveTo(layout.gutterWidth + 0.5, 0);
  ctx.lineTo(layout.gutterWidth + 0.5, paintH);
  for (let c = 0; c < cols; c += 1) {
    const width = layout.columnWidths[c] ?? 0;
    const x = columnLeft(layout, c) + width;
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, paintH);
  }

  ctx.stroke();
}
