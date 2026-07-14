import {
  asEditableGrid,
  beginEdit,
  cancelEdit,
  colIndexToLetters,
  commitEdit,
  formulaBarText,
  hitTestDataCell,
  isSelectionNavKey,
  moveSelection,
  paintStaticGrid,
  updateDraft,
  type CellAddress,
  type EditSession,
  type GridLayout,
} from "@gridyard/grid-renderer";

import init, { create_grid } from "./wasm-pkg/gridyard_wasm.js";

async function main(): Promise<void> {
  const statusEl = document.getElementById("status");
  const canvasEl = document.getElementById("grid");
  const formulaInputEl = document.getElementById("formula-input");
  const formulaAddrEl = document.getElementById("formula-addr");
  if (
    !(canvasEl instanceof HTMLCanvasElement) ||
    statusEl === null ||
    !(formulaInputEl instanceof HTMLInputElement) ||
    formulaAddrEl === null
  ) {
    throw new Error("expected #grid, #status, #formula-input, #formula-addr");
  }
  const canvas: HTMLCanvasElement = canvasEl;
  const status: HTMLElement = statusEl;
  const formulaInput: HTMLInputElement = formulaInputEl;
  const formulaAddr: HTMLElement = formulaAddrEl;
  const maybeCtx = canvas.getContext("2d");
  if (maybeCtx === null) {
    throw new Error("2d context unavailable");
  }
  const ctx: CanvasRenderingContext2D = maybeCtx;

  await init();
  const grid = asEditableGrid(create_grid());

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
  let session: EditSession | null = null;

  const paintOptionsBase = {
    rows: bounds.rows,
    cols: bounds.cols,
    columnNames: ["Borrower", "Amount", "Status", "Days late"],
    columnWidths: [168, 90, 84, 90],
    numericColumns: new Set([1, 3]),
    source: grid,
  };

  function formatSelection(active: CellAddress | null): string {
    if (active === null) {
      return "(none)";
    }
    return `${colIndexToLetters(active.col)}${String(active.row + 1)}`;
  }

  function syncFormulaBarFromGrid(): void {
    formulaAddr.textContent = formatSelection(selection);
    formulaInput.value = formulaBarText(grid, selection);
    session = null;
  }

  function startSessionFromBar(): void {
    if (selection === null || session !== null) {
      return;
    }
    session = beginEdit(selection, formulaBarText(grid, selection));
  }

  function repaint(): void {
    layout = paintStaticGrid(ctx, { ...paintOptionsBase, selection });
    canvas.width = layout.totalWidth;
    canvas.height = layout.totalHeight;
    layout = paintStaticGrid(ctx, { ...paintOptionsBase, selection });
    const active = selection === null ? null : grid.get_cell(selection.row, selection.col);
    const valueHint =
      active === null ? "" : ` · value ${JSON.stringify(active)}`;
    status.textContent = `Selected ${formatSelection(selection)}${valueHint}`;
  }

  function commitFromBar(navKey: "Enter" | "Tab" | null): void {
    if (selection === null) {
      return;
    }
    const activeSession =
      session ?? beginEdit(selection, formulaBarText(grid, selection));
    const withDraft = updateDraft(activeSession, formulaInput.value);
    commitEdit(grid, withDraft);
    session = null;
    if (navKey !== null) {
      selection = moveSelection(selection, navKey, bounds);
    }
    syncFormulaBarFromGrid();
    repaint();
  }

  function cancelFromBar(): void {
    if (session === null) {
      formulaInput.value = formulaBarText(grid, selection);
      return;
    }
    const restored = cancelEdit(session);
    session = null;
    formulaInput.value = restored.input;
  }

  canvas.tabIndex = 0;
  canvas.style.outline = "none";
  canvas.style.cursor = "cell";

  canvas.addEventListener("pointerdown", (event) => {
    if (layout === null) {
      return;
    }
    if (session !== null && formulaInput.value !== session.original) {
      commitFromBar(null);
    } else {
      session = null;
    }
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hit = hitTestDataCell(layout, x, y, bounds);
    if (hit === null) {
      return;
    }
    selection = hit;
    syncFormulaBarFromGrid();
    repaint();
    canvas.focus();
  });

  canvas.addEventListener("keydown", (event) => {
    if (!isSelectionNavKey(event.key)) {
      return;
    }
    event.preventDefault();
    if (session !== null && formulaInput.value !== session.original) {
      commitFromBar(null);
    }
    selection = moveSelection(selection, event.key, bounds);
    syncFormulaBarFromGrid();
    repaint();
  });

  formulaInput.addEventListener("focus", () => {
    startSessionFromBar();
  });

  formulaInput.addEventListener("input", () => {
    startSessionFromBar();
    if (session !== null) {
      session = updateDraft(session, formulaInput.value);
    }
  });

  formulaInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitFromBar("Enter");
      canvas.focus();
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      commitFromBar("Tab");
      canvas.focus();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelFromBar();
      canvas.focus();
    }
  });

  syncFormulaBarFromGrid();
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
