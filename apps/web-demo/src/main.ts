import {
  asGridDataSource,
  colIndexToLetters,
  hitTestDataCell,
  isSelectionNavKey,
  moveSelection,
  paintStaticGrid,
  type CellAddress,
  type GridLayout,
} from "@gridyard/grid-renderer";

import init, { create_grid } from "./wasm-pkg/gridyard_wasm.js";

async function main(): Promise<void> {
  const statusEl = document.getElementById("status");
  const canvasEl = document.getElementById("grid");
  if (!(canvasEl instanceof HTMLCanvasElement) || statusEl === null) {
    throw new Error("expected #grid canvas and #status");
  }
  const canvas: HTMLCanvasElement = canvasEl;
  const status: HTMLElement = statusEl;
  const maybeCtx = canvas.getContext("2d");
  if (maybeCtx === null) {
    throw new Error("2d context unavailable");
  }
  const ctx: CanvasRenderingContext2D = maybeCtx;

  await init();
  const grid = create_grid();

  // Loan-review-ish sheet; Status uses IF(days) so non-zero late days → Overdue.
  // (Comparison operators are not in the v0.1 parser yet.)
  const rows: Array<[string, string, string]> = [
    ["Ada Lovelace", "1200", "12"],
    ["Grace Hopper", "0", "0"],
    ["Alan Turing", "800", "4"],
  ];
  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r];
    if (row === undefined) {
      continue;
    }
    const [borrower, amount, days] = row;
    const rowNum = String(r + 1);
    grid.set_cell(r, 0, borrower);
    grid.set_cell(r, 1, amount);
    grid.set_cell(r, 3, days);
    grid.set_cell(r, 2, `=IF(D${rowNum},"Overdue","Active")`);
  }

  const bounds = { rows: 3, cols: 4 };
  let selection: CellAddress | null = { row: 0, col: 0 };
  let layout: GridLayout | null = null;

  const paintOptionsBase = {
    rows: bounds.rows,
    cols: bounds.cols,
    columnNames: ["Borrower", "Amount", "Status", "Days late"],
    columnWidths: [168, 90, 84, 90],
    numericColumns: new Set([1, 3]),
    source: asGridDataSource(grid),
  };

  function formatSelection(active: CellAddress | null): string {
    if (active === null) {
      return "(none)";
    }
    return `${colIndexToLetters(active.col)}${String(active.row + 1)}`;
  }

  function repaint(): void {
    layout = paintStaticGrid(ctx, { ...paintOptionsBase, selection });
    canvas.width = layout.totalWidth;
    canvas.height = layout.totalHeight;
    layout = paintStaticGrid(ctx, { ...paintOptionsBase, selection });
    status.textContent = `Selected ${formatSelection(selection)} — click a cell or use arrows / Enter / Tab`;
  }

  canvas.tabIndex = 0;
  canvas.style.outline = "none";
  canvas.style.cursor = "cell";

  canvas.addEventListener("pointerdown", (event) => {
    if (layout === null) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hit = hitTestDataCell(layout, x, y, bounds);
    if (hit === null) {
      return;
    }
    selection = hit;
    repaint();
    canvas.focus();
  });

  canvas.addEventListener("keydown", (event) => {
    if (!isSelectionNavKey(event.key)) {
      return;
    }
    event.preventDefault();
    selection = moveSelection(selection, event.key, bounds);
    repaint();
  });

  repaint();
  canvas.focus();
}

main().catch((err: unknown) => {
  const status = document.getElementById("status");
  if (status !== null) {
    status.textContent = `Failed: ${String(err)}`;
  }
  console.error(err);
});
