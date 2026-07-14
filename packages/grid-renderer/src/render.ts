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

/** Colors aligned with `docs/workspace-ui-mockup.html`. */
export const GRID_THEME = {
  textPrimary: "#101014",
  textSecondary: "#52525b",
  textMuted: "#8b8b93",
  border: "#e4e4e7",
  surface0: "#ffffff",
  surface1: "#f4f4f5",
  /** Active selection fill (`--bg-accent` in the mockup). */
  selectionFill: "#e6f1fb",
  /** Active selection border (`--fill-accent` in the mockup). */
  selectionBorder: "#378add",
} as const;

export interface PaintStaticGridOptions extends GridLayoutInput {
  /** Human-readable field names for the name row (one per column). */
  columnNames: readonly string[];
  /** Live grid data — typically a `gridyard-wasm` `Grid`. */
  source: GridDataSource;
  /** Columns whose values should be right-aligned (like mockup `.num`). */
  numericColumns?: ReadonlySet<number>;
  /** Single active cell to highlight; omit or `null` for none. */
  selection?: CellAddress | null;
}

/**
 * Paints a fixed-size main-region grid onto `ctx`: ref row, name row,
 * row gutter, and cell values from `source.get_cell`.
 *
 * Returns the resolved layout (useful for sizing the canvas element).
 */
export function paintStaticGrid(
  ctx: CanvasRenderingContext2D,
  options: PaintStaticGridOptions,
): GridLayout {
  const layout = computeGridLayout(options);
  const { rows, cols, columnNames, source, numericColumns, selection } = options;

  ctx.save();
  ctx.clearRect(0, 0, layout.totalWidth, layout.totalHeight);
  ctx.fillStyle = GRID_THEME.surface0;
  ctx.fillRect(0, 0, layout.totalWidth, layout.totalHeight);

  paintHeaderBackground(ctx, layout);
  paintRefRow(ctx, layout, cols);
  paintNameRow(ctx, layout, columnNames);
  paintGutter(ctx, layout, rows);
  paintSelectionFill(ctx, layout, rows, cols, selection ?? null);
  paintBody(ctx, layout, rows, cols, source, numericColumns ?? new Set());
  paintGridLines(ctx, layout, rows, cols);
  paintSelectionBorder(ctx, layout, rows, cols, selection ?? null);

  ctx.restore();
  return layout;
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

function paintSelectionFill(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
  rows: number,
  cols: number,
  selection: CellAddress | null,
): void {
  const active = selectionInBounds(selection, rows, cols);
  if (active === null) {
    return;
  }
  const rect = dataCellRect(layout, active.row, active.col);
  ctx.fillStyle = GRID_THEME.selectionFill;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
}

function paintSelectionBorder(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
  rows: number,
  cols: number,
  selection: CellAddress | null,
): void {
  const active = selectionInBounds(selection, rows, cols);
  if (active === null) {
    return;
  }
  const rect = dataCellRect(layout, active.row, active.col);
  ctx.strokeStyle = GRID_THEME.selectionBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
}

function paintHeaderBackground(ctx: CanvasRenderingContext2D, layout: GridLayout): void {
  ctx.fillStyle = GRID_THEME.surface1;
  ctx.fillRect(0, 0, layout.totalWidth, layout.headerHeight);
  ctx.fillRect(0, layout.headerHeight, layout.gutterWidth, layout.bodyHeight);
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

function paintGutter(ctx: CanvasRenderingContext2D, layout: GridLayout, rows: number): void {
  ctx.fillStyle = GRID_THEME.textMuted;
  ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let r = 0; r < rows; r += 1) {
    const y = layout.headerHeight + r * layout.rowHeight + layout.rowHeight / 2;
    ctx.fillText(rowIndexToLabel(r), layout.gutterWidth / 2, y);
  }
}

function paintBody(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
  rows: number,
  cols: number,
  source: GridDataSource,
  numericColumns: ReadonlySet<number>,
): void {
  ctx.fillStyle = GRID_THEME.textPrimary;
  ctx.font = "13px ui-sans-serif, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const rect = dataCellRect(layout, r, c);
      const text = formatCellValue(source.get_cell(r, c));
      const y = rect.y + rect.height / 2;
      if (numericColumns.has(c)) {
        ctx.textAlign = "right";
        ctx.fillText(text, rect.x + rect.width - 10, y, rect.width - 16);
      } else {
        ctx.textAlign = "left";
        ctx.fillText(text, rect.x + 10, y, rect.width - 16);
      }
    }
  }
}

function paintGridLines(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
  rows: number,
  cols: number,
): void {
  ctx.strokeStyle = GRID_THEME.border;
  ctx.lineWidth = 1;
  ctx.beginPath();

  // Horizontal: below ref, below name, then each body row.
  let y = layout.refRowHeight;
  ctx.moveTo(0, y + 0.5);
  ctx.lineTo(layout.totalWidth, y + 0.5);
  y = layout.headerHeight;
  ctx.moveTo(0, y + 0.5);
  ctx.lineTo(layout.totalWidth, y + 0.5);
  for (let r = 1; r <= rows; r += 1) {
    const yy = layout.headerHeight + r * layout.rowHeight;
    ctx.moveTo(0, yy + 0.5);
    ctx.lineTo(layout.totalWidth, yy + 0.5);
  }

  // Vertical: after gutter, then each column.
  ctx.moveTo(layout.gutterWidth + 0.5, 0);
  ctx.lineTo(layout.gutterWidth + 0.5, layout.totalHeight);
  for (let c = 0; c < cols; c += 1) {
    const width = layout.columnWidths[c] ?? 0;
    const x = columnLeft(layout, c) + width;
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, layout.totalHeight);
  }

  ctx.stroke();
}
