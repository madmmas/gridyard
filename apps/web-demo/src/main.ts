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

import { loadLoanReviewMain } from "./load-loan-review.js";
import {
  paintConfigFromLayout,
  seedGridFromBoundMain,
} from "./seed-from-bound-grid.js";
import init, { create_grid } from "./wasm-pkg/gridyard_wasm.js";

async function main(): Promise<void> {
  const statusEl = document.getElementById("status");
  const canvasEl = document.getElementById("grid");
  const formulaInputEl = document.getElementById("formula-input");
  const formulaAddrEl = document.getElementById("formula-addr");
  const workspaceTitleEl = document.getElementById("workspace-title");
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

  status.textContent = "Loading workspace + loans…";
  const loaded = await loadLoanReviewMain();
  if (!loaded.ok) {
    status.textContent = `Failed to load loans: ${loaded.error.message}. Is the mock server on :4000? (make up)`;
    return;
  }
  const workspaceLayout = loaded.layout;
  const boundGrid = loaded.grid;

  if (workspaceTitleEl !== null) {
    workspaceTitleEl.textContent = workspaceLayout.name;
  }

  await init();
  const rawGrid = create_grid();
  const grid = asEditableGrid(rawGrid);

  const dims = seedGridFromBoundMain(grid, boundGrid);
  // Don't let the user undo into fixture seeding.
  rawGrid.clear_history();

  const paintConfig = paintConfigFromLayout(workspaceLayout, dims.rows);
  const bounds = { rows: dims.rows, cols: dims.cols };
  let selection: CellAddress | null =
    dims.rows > 0 && dims.cols > 0 ? { row: 0, col: 0 } : null;
  let layout: GridLayout | null = null;
  let session: EditSession | null = null;

  const paintOptionsBase = {
    rows: paintConfig.rows,
    cols: paintConfig.cols,
    columnNames: paintConfig.columnNames,
    columnWidths: paintConfig.columnWidths,
    numericColumns: paintConfig.numericColumns,
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
    const hist =
      rawGrid.can_undo() || rawGrid.can_redo()
        ? ` · undo ${rawGrid.can_undo() ? "ready" : "—"} / redo ${rawGrid.can_redo() ? "ready" : "—"}`
        : "";
    status.textContent = `${workspaceLayout.name} · ${String(dims.rows)} loans · selected ${formatSelection(selection)}${valueHint}${hist}`;
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

  function applyHistory(kind: "undo" | "redo"): void {
    session = null;
    const changed = kind === "undo" ? rawGrid.undo() : rawGrid.redo();
    if (!changed) {
      return;
    }
    syncFormulaBarFromGrid();
    repaint();
  }

  function isMod(event: KeyboardEvent): boolean {
    return event.metaKey || event.ctrlKey;
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
    if (isMod(event) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      applyHistory(event.shiftKey ? "redo" : "undo");
      return;
    }
    if (isMod(event) && event.key.toLowerCase() === "y") {
      event.preventDefault();
      applyHistory("redo");
      return;
    }
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
    if (isMod(event) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      applyHistory(event.shiftKey ? "redo" : "undo");
      return;
    }
    if (isMod(event) && event.key.toLowerCase() === "y") {
      event.preventDefault();
      applyHistory("redo");
      return;
    }
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
