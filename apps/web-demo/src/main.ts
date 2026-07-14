import {
  addNotesRow,
  asRegionEditableGrid,
  beginEdit,
  bottomControlTarget,
  cancelEdit,
  colIndexToLetters,
  commitEdit,
  computeBottomLayoutFromMain,
  computeGridLayout,
  createBottomTabState,
  createNotesRows,
  formulaBarText,
  hitTestDataCell,
  isSelectionNavKey,
  moveSelection,
  paintStaticGrid,
  selectBottomTab,
  updateDraft,
  updateNotesRow,
  type BottomTabState,
  type CellAddress,
  type EditSession,
  type EditableGrid,
  type GridLayout,
  type NotesRow,
  type WorkspaceRegion,
} from "@gridyard/grid-renderer";

import { loadLoanReviewMain } from "./load-loan-review.js";
import {
  paintConfigFromLayout,
  seedBottomAggregate,
  seedGridFromBoundMain,
} from "./seed-from-bound-grid.js";
import init, { create_workspace } from "./wasm-pkg/gridyard_wasm.js";

interface RegionUi {
  region: WorkspaceRegion;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  formulaInput: HTMLInputElement;
  formulaAddr: HTMLElement;
  grid: EditableGrid;
  bounds: { rows: number; cols: number };
  selection: CellAddress | null;
  layout: GridLayout | null;
  session: EditSession | null;
  paintBase: {
    rows: number;
    cols: number;
    columnNames: readonly string[];
    columnWidths: readonly number[];
    numericColumns: ReadonlySet<number>;
    chrome: "main" | "bottom";
  };
}

async function main(): Promise<void> {
  const statusEl = document.getElementById("status");
  const mainCanvasEl = document.getElementById("main-grid");
  const bottomCanvasEl = document.getElementById("bottom-grid");
  const mainFormulaInputEl = document.getElementById("main-formula-input");
  const bottomFormulaInputEl = document.getElementById("bottom-formula-input");
  const mainFormulaAddrEl = document.getElementById("main-formula-addr");
  const bottomFormulaAddrEl = document.getElementById("bottom-formula-addr");
  const workspaceTitleEl = document.getElementById("workspace-title");
  const tabAggregateEl = document.getElementById("tab-aggregate");
  const tabNotesEl = document.getElementById("tab-notes");
  const panelAggregateEl = document.getElementById("panel-aggregate");
  const panelNotesEl = document.getElementById("panel-notes");
  const notesBodyEl = document.getElementById("notes-body");
  const bottomAddRowEl = document.getElementById("bottom-add-row");
  if (
    !(mainCanvasEl instanceof HTMLCanvasElement) ||
    !(bottomCanvasEl instanceof HTMLCanvasElement) ||
    statusEl === null ||
    !(mainFormulaInputEl instanceof HTMLInputElement) ||
    !(bottomFormulaInputEl instanceof HTMLInputElement) ||
    mainFormulaAddrEl === null ||
    bottomFormulaAddrEl === null ||
    !(tabAggregateEl instanceof HTMLButtonElement) ||
    !(tabNotesEl instanceof HTMLButtonElement) ||
    panelAggregateEl === null ||
    panelNotesEl === null ||
    notesBodyEl === null ||
    !(bottomAddRowEl instanceof HTMLButtonElement)
  ) {
    throw new Error("expected main/bottom grid + formula bar + tab elements");
  }
  const status: HTMLElement = statusEl;
  const tabAggregate = tabAggregateEl;
  const tabNotes = tabNotesEl;
  const panelAggregate = panelAggregateEl;
  const panelNotes = panelNotesEl;
  const notesBody = notesBodyEl;
  const bottomAddRow = bottomAddRowEl;
  const mainCtx = mainCanvasEl.getContext("2d");
  const bottomCtx = bottomCanvasEl.getContext("2d");
  if (mainCtx === null || bottomCtx === null) {
    throw new Error("2d context unavailable");
  }

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
  const rawWorkspace = create_workspace();
  const mainGrid = asRegionEditableGrid(rawWorkspace, "main");
  const bottomGrid = asRegionEditableGrid(rawWorkspace, "bottom");

  const dims = seedGridFromBoundMain(mainGrid, boundGrid);
  const paintConfig = paintConfigFromLayout(workspaceLayout, dims.rows);
  const bottomDims = seedBottomAggregate(
    bottomGrid,
    dims.rows,
    dims.cols,
    paintConfig.numericColumns,
  );

  const mainUi: RegionUi = {
    region: "main",
    canvas: mainCanvasEl,
    ctx: mainCtx,
    formulaInput: mainFormulaInputEl,
    formulaAddr: mainFormulaAddrEl,
    grid: mainGrid,
    bounds: { rows: dims.rows, cols: dims.cols },
    selection:
      dims.rows > 0 && dims.cols > 0 ? { row: 0, col: 0 } : null,
    layout: null,
    session: null,
    paintBase: {
      rows: paintConfig.rows,
      cols: paintConfig.cols,
      columnNames: paintConfig.columnNames,
      columnWidths: paintConfig.columnWidths,
      numericColumns: paintConfig.numericColumns,
      chrome: "main",
    },
  };

  const bottomUi: RegionUi = {
    region: "bottom",
    canvas: bottomCanvasEl,
    ctx: bottomCtx,
    formulaInput: bottomFormulaInputEl,
    formulaAddr: bottomFormulaAddrEl,
    grid: bottomGrid,
    bounds: { rows: bottomDims.rows, cols: bottomDims.cols },
    selection:
      bottomDims.rows > 0 && bottomDims.cols > 0 ? { row: 0, col: 0 } : null,
    layout: null,
    session: null,
    paintBase: {
      rows: bottomDims.rows,
      cols: bottomDims.cols,
      columnNames: paintConfig.columnNames,
      columnWidths: paintConfig.columnWidths,
      numericColumns: paintConfig.numericColumns,
      chrome: "bottom",
    },
  };

  function formatSelection(active: CellAddress | null): string {
    if (active === null) {
      return "(none)";
    }
    return `${colIndexToLetters(active.col)}${String(active.row + 1)}`;
  }

  function syncFormulaBar(ui: RegionUi): void {
    ui.formulaAddr.textContent = formatSelection(ui.selection);
    ui.formulaInput.value = formulaBarText(ui.grid, ui.selection);
    ui.session = null;
  }

  function startSessionFromBar(ui: RegionUi): void {
    if (ui.selection === null || ui.session !== null) {
      return;
    }
    ui.session = beginEdit(ui.selection, formulaBarText(ui.grid, ui.selection));
  }

  function repaintAll(): void {
    const mainLayout = computeGridLayout({
      rows: mainUi.paintBase.rows,
      cols: mainUi.paintBase.cols,
      columnWidths: mainUi.paintBase.columnWidths,
    });
    const bottomSynced = computeBottomLayoutFromMain(
      mainLayout,
      bottomUi.paintBase.rows,
    );
    bottomUi.paintBase = {
      ...bottomUi.paintBase,
      columnWidths: bottomSynced.columnWidths,
    };

    mainUi.layout = paintStaticGrid(mainUi.ctx, {
      ...mainUi.paintBase,
      source: mainUi.grid,
      selection: mainUi.selection,
    });
    mainUi.canvas.width = mainUi.layout.totalWidth;
    mainUi.canvas.height = mainUi.layout.totalHeight;
    mainUi.layout = paintStaticGrid(mainUi.ctx, {
      ...mainUi.paintBase,
      source: mainUi.grid,
      selection: mainUi.selection,
    });

    bottomUi.layout = paintStaticGrid(bottomUi.ctx, {
      ...bottomUi.paintBase,
      source: bottomUi.grid,
      selection: bottomUi.selection,
    });
    bottomUi.canvas.width = bottomUi.layout.totalWidth;
    bottomUi.canvas.height = bottomUi.layout.totalHeight;
    bottomUi.layout = paintStaticGrid(bottomUi.ctx, {
      ...bottomUi.paintBase,
      source: bottomUi.grid,
      selection: bottomUi.selection,
    });

    status.textContent = `${workspaceLayout.name} · ${String(dims.rows)} loans · main ${formatSelection(mainUi.selection)} · bottom ${formatSelection(bottomUi.selection)}`;
  }

  function commitFromBar(ui: RegionUi, navKey: "Enter" | "Tab" | null): void {
    if (ui.selection === null) {
      return;
    }
    const activeSession =
      ui.session ?? beginEdit(ui.selection, formulaBarText(ui.grid, ui.selection));
    const withDraft = updateDraft(activeSession, ui.formulaInput.value);
    commitEdit(ui.grid, withDraft);
    ui.session = null;
    if (navKey !== null) {
      ui.selection = moveSelection(ui.selection, navKey, ui.bounds);
    }
    syncFormulaBar(ui);
    // Main edits must refresh bottom Aggregate (cross-region reads).
    repaintAll();
  }

  function cancelFromBar(ui: RegionUi): void {
    if (ui.session === null) {
      ui.formulaInput.value = formulaBarText(ui.grid, ui.selection);
      return;
    }
    const restored = cancelEdit(ui.session);
    ui.session = null;
    ui.formulaInput.value = restored.input;
  }

  function wireRegion(ui: RegionUi): void {
    ui.canvas.tabIndex = 0;
    ui.canvas.style.outline = "none";
    ui.canvas.style.cursor = "cell";

    ui.canvas.addEventListener("pointerdown", (event) => {
      if (ui.layout === null) {
        return;
      }
      if (ui.session !== null && ui.formulaInput.value !== ui.session.original) {
        commitFromBar(ui, null);
      } else {
        ui.session = null;
      }
      const rect = ui.canvas.getBoundingClientRect();
      const hit = hitTestDataCell(
        ui.layout,
        event.clientX - rect.left,
        event.clientY - rect.top,
        ui.bounds,
      );
      if (hit === null) {
        return;
      }
      ui.selection = hit;
      syncFormulaBar(ui);
      repaintAll();
      ui.canvas.focus();
    });

    ui.canvas.addEventListener("keydown", (event) => {
      if (!isSelectionNavKey(event.key)) {
        return;
      }
      event.preventDefault();
      if (ui.session !== null && ui.formulaInput.value !== ui.session.original) {
        commitFromBar(ui, null);
      }
      ui.selection = moveSelection(ui.selection, event.key, ui.bounds);
      syncFormulaBar(ui);
      repaintAll();
    });

    ui.formulaInput.addEventListener("focus", () => {
      startSessionFromBar(ui);
    });
    ui.formulaInput.addEventListener("input", () => {
      startSessionFromBar(ui);
      if (ui.session !== null) {
        ui.session = updateDraft(ui.session, ui.formulaInput.value);
      }
    });
    ui.formulaInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitFromBar(ui, "Enter");
        ui.canvas.focus();
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        commitFromBar(ui, "Tab");
        ui.canvas.focus();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancelFromBar(ui);
        ui.canvas.focus();
      }
    });
  }

  wireRegion(mainUi);
  wireRegion(bottomUi);
  syncFormulaBar(mainUi);
  syncFormulaBar(bottomUi);

  let bottomTabs: BottomTabState = createBottomTabState(
    workspaceLayout.bottom.activeTab,
  );
  let notesRows: NotesRow[] = createNotesRows([
    { label: "Approval policy", value: "policy.pdf" },
    { label: "Q1 review", value: "notes.docx" },
  ]);

  function applyBottomTabUi(): void {
    const onAggregate = bottomTabs.active === "aggregate";
    tabAggregate.classList.toggle("active", onAggregate);
    tabNotes.classList.toggle("active", !onAggregate);
    tabAggregate.setAttribute("aria-selected", onAggregate ? "true" : "false");
    tabNotes.setAttribute("aria-selected", onAggregate ? "false" : "true");
    panelAggregate.classList.toggle("active", onAggregate);
    panelNotes.classList.toggle("active", !onAggregate);
    panelAggregate.hidden = !onAggregate;
    panelNotes.hidden = onAggregate;
    // Keep Aggregate session/draft/canvas intact while Notes is shown.
  }

  function renderNotesTable(): void {
    notesBody.replaceChildren();
    notesRows.forEach((row, index) => {
      const tr = document.createElement("tr");
      const labelTd = document.createElement("td");
      const valueTd = document.createElement("td");
      const labelInput = document.createElement("input");
      const valueInput = document.createElement("input");
      labelInput.type = "text";
      valueInput.type = "text";
      labelInput.value = row.label;
      valueInput.value = row.value;
      labelInput.setAttribute("aria-label", `Notes label ${String(index + 1)}`);
      valueInput.setAttribute("aria-label", `Notes value ${String(index + 1)}`);
      labelInput.addEventListener("input", () => {
        notesRows = updateNotesRow(notesRows, index, { label: labelInput.value });
      });
      valueInput.addEventListener("input", () => {
        notesRows = updateNotesRow(notesRows, index, { value: valueInput.value });
      });
      labelTd.append(labelInput);
      valueTd.append(valueInput);
      tr.append(labelTd, valueTd);
      notesBody.append(tr);
    });
  }

  function switchBottomTab(tab: "aggregate" | "notes"): void {
    bottomTabs = selectBottomTab(bottomTabs, tab);
    applyBottomTabUi();
    if (bottomTabs.active === "aggregate") {
      // Restore Aggregate paint; Notes stay in memory via notesRows.
      repaintAll();
    } else {
      renderNotesTable();
    }
    status.textContent = `${workspaceLayout.name} · ${String(dims.rows)} loans · bottom tab ${bottomTabs.active}`;
  }

  tabAggregate.addEventListener("click", () => {
    switchBottomTab("aggregate");
  });
  tabNotes.addEventListener("click", () => {
    switchBottomTab("notes");
  });
  bottomAddRow.addEventListener("click", () => {
    const target = bottomControlTarget(bottomTabs);
    if (target === "notes") {
      notesRows = addNotesRow(notesRows);
      renderNotesTable();
      return;
    }
    // Aggregate add-row: grow an empty Aggregate row (engine-backed).
    const nextRow = bottomUi.paintBase.rows;
    bottomUi.grid.set_cell(nextRow, 0, "");
    bottomUi.paintBase = {
      ...bottomUi.paintBase,
      rows: nextRow + 1,
    };
    bottomUi.bounds = {
      rows: bottomUi.paintBase.rows,
      cols: bottomUi.paintBase.cols,
    };
    if (bottomUi.selection === null) {
      bottomUi.selection = { row: nextRow, col: 0 };
    }
    syncFormulaBar(bottomUi);
    repaintAll();
  });

  applyBottomTabUi();
  renderNotesTable();
  repaintAll();
  mainUi.canvas.focus();
}

main().catch((err: unknown) => {
  const status = document.getElementById("status");
  if (status !== null) {
    status.textContent = `Failed: ${String(err)}`;
  }
  console.error(err);
});
