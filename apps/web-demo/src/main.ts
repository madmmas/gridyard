import {
  addNotesRow,
  asRegionEditableGrid,
  beginEdit,
  bottomControlTarget,
  cancelEdit,
  clampSelection,
  colIndexToLetters,
  commitEditWithAccess,
  computeBottomLayoutFromMain,
  computeGridLayout,
  createBottomTabState,
  createNotesRows,
  formulaBarText,
  hitTestDataCell,
  isSelectionNavKey,
  moveSelection,
  paintStaticGrid,
  remapEditableGrid,
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
import {
  EMPLOYEE_MANAGEMENT_PERMISSIONS,
  EMPLOYEE_MANAGEMENT_SAMPLE_USERS,
  EMPLOYEE_MANAGEMENT_WORKSPACE,
  LOAN_REVIEW_PERMISSIONS,
  LOAN_REVIEW_SAMPLE_USERS,
  LOAN_REVIEW_WORKSPACE,
  buildFormView,
  isRegionVisible,
  projectColumnsForPermissions,
  resolvePermissions,
  type BoundMainGrid,
  type BoundRow,
  type EffectivePermissions,
  type LayeredPermissionDefinition,
  type PermissionColumnProjection,
  type SamplePermissionUser,
  type WorkspaceDefinition,
  type WorkspaceLayout,
} from "@gridyard/workspace-runtime";

import { historyActionFromKey } from "./history-keys.js";
import { loadWorkspaceMain } from "./load-workspace.js";
import { renderFormView } from "./render-form.js";
import {
  engineNumericColumns,
  paintConfigFromPermissionProjection,
  seedBottomAggregate,
  seedGridFromBoundMain,
} from "./seed-from-bound-grid.js";
import init, { create_workspace } from "./wasm-pkg/gridyard_wasm.js";

interface DemoWorkspaceEntry {
  id: string;
  definition: WorkspaceDefinition;
  permissions: LayeredPermissionDefinition;
  sampleUsers: readonly SamplePermissionUser[];
}

const DEMO_WORKSPACES: readonly DemoWorkspaceEntry[] = [
  {
    id: "loan-review",
    definition: LOAN_REVIEW_WORKSPACE,
    permissions: LOAN_REVIEW_PERMISSIONS,
    sampleUsers: LOAN_REVIEW_SAMPLE_USERS,
  },
  {
    id: "employee-management",
    definition: EMPLOYEE_MANAGEMENT_WORKSPACE,
    permissions: EMPLOYEE_MANAGEMENT_PERMISSIONS,
    sampleUsers: EMPLOYEE_MANAGEMENT_SAMPLE_USERS,
  },
];

interface RegionUi {
  region: WorkspaceRegion;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  formulaInput: HTMLInputElement;
  formulaAddr: HTMLElement;
  /** Full-column engine-backed grid. */
  engineGrid: EditableGrid;
  /** Paint-index remapped grid (hidden columns omitted). */
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
  const workspaceSelectEl = document.getElementById("workspace-select");
  const mainPanelHeaderEl = document.getElementById("main-panel-header");
  const formBodyEl = document.getElementById("form-body");
  const formPanelHeaderEl = document.getElementById("form-panel-header");
  const tabAggregateEl = document.getElementById("tab-aggregate");
  const tabNotesEl = document.getElementById("tab-notes");
  const panelAggregateEl = document.getElementById("panel-aggregate");
  const panelNotesEl = document.getElementById("panel-notes");
  const notesBodyEl = document.getElementById("notes-body");
  const bottomAddRowEl = document.getElementById("bottom-add-row");
  const bottomPanelEl = document.getElementById("bottom-panel");
  const userSelectEl = document.getElementById("demo-user");
  if (
    !(mainCanvasEl instanceof HTMLCanvasElement) ||
    !(bottomCanvasEl instanceof HTMLCanvasElement) ||
    statusEl === null ||
    !(mainFormulaInputEl instanceof HTMLInputElement) ||
    !(bottomFormulaInputEl instanceof HTMLInputElement) ||
    mainFormulaAddrEl === null ||
    bottomFormulaAddrEl === null ||
    !(workspaceSelectEl instanceof HTMLSelectElement) ||
    mainPanelHeaderEl === null ||
    formBodyEl === null ||
    formPanelHeaderEl === null ||
    !(tabAggregateEl instanceof HTMLButtonElement) ||
    !(tabNotesEl instanceof HTMLButtonElement) ||
    panelAggregateEl === null ||
    panelNotesEl === null ||
    notesBodyEl === null ||
    !(bottomAddRowEl instanceof HTMLButtonElement) ||
    bottomPanelEl === null ||
    !(userSelectEl instanceof HTMLSelectElement)
  ) {
    throw new Error(
      "expected main/bottom grid + formula bar + tabs + workspace/user/form elements",
    );
  }
  const status: HTMLElement = statusEl;
  const workspaceSelect = workspaceSelectEl;
  const mainPanelHeader = mainPanelHeaderEl;
  const formBody = formBodyEl;
  const formPanelHeader = formPanelHeaderEl;
  const tabAggregate = tabAggregateEl;
  const tabNotes = tabNotesEl;
  const panelAggregate = panelAggregateEl;
  const panelNotes = panelNotesEl;
  const notesBody = notesBodyEl;
  const bottomAddRow = bottomAddRowEl;
  const bottomPanel = bottomPanelEl;
  const userSelect = userSelectEl;
  const mainCtx = mainCanvasEl.getContext("2d");
  const bottomCtx = bottomCanvasEl.getContext("2d");
  if (mainCtx === null || bottomCtx === null) {
    throw new Error("2d context unavailable");
  }

  for (const entry of DEMO_WORKSPACES) {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = entry.definition.name;
    workspaceSelect.append(option);
  }
  workspaceSelect.value = DEMO_WORKSPACES[0]?.id ?? "loan-review";

  await init();

  let activeEntry!: DemoWorkspaceEntry;
  const firstWorkspace = DEMO_WORKSPACES[0];
  if (firstWorkspace === undefined) {
    throw new Error("no demo workspaces configured");
  }
  activeEntry = firstWorkspace;

  let rawWorkspace = create_workspace();
  let mainEngine = asRegionEditableGrid(rawWorkspace, "main");
  let bottomEngine = asRegionEditableGrid(rawWorkspace, "bottom");

  let workspaceLayout!: WorkspaceLayout;
  let boundRows: BoundRow[] = [];
  let dims = { rows: 0, cols: 0 };
  let effective!: EffectivePermissions;
  let projection!: PermissionColumnProjection;
  let lastDeniedMessage: string | null = null;

  const mainUi: RegionUi = {
    region: "main",
    canvas: mainCanvasEl,
    ctx: mainCtx,
    formulaInput: mainFormulaInputEl,
    formulaAddr: mainFormulaAddrEl,
    engineGrid: mainEngine,
    grid: mainEngine,
    bounds: { rows: 0, cols: 0 },
    selection: null,
    layout: null,
    session: null,
    paintBase: {
      rows: 0,
      cols: 0,
      columnNames: [],
      columnWidths: [],
      numericColumns: new Set(),
      chrome: "main",
    },
  };

  const bottomUi: RegionUi = {
    region: "bottom",
    canvas: bottomCanvasEl,
    ctx: bottomCtx,
    formulaInput: bottomFormulaInputEl,
    formulaAddr: bottomFormulaAddrEl,
    engineGrid: bottomEngine,
    grid: bottomEngine,
    bounds: { rows: 0, cols: 0 },
    selection: null,
    layout: null,
    session: null,
    paintBase: {
      rows: 0,
      cols: 0,
      columnNames: [],
      columnWidths: [],
      numericColumns: new Set(),
      chrome: "bottom",
    },
  };

  let bottomTabs: BottomTabState = createBottomTabState("aggregate");
  let notesRows: NotesRow[] = createNotesRows([
    { label: "Approval policy", value: "policy.pdf" },
    { label: "Q1 review", value: "notes.docx" },
  ]);

  function formatSelection(active: CellAddress | null): string {
    if (active === null) {
      return "(none)";
    }
    return `${colIndexToLetters(active.col)}${String(active.row + 1)}`;
  }

  function accessForSelection(ui: RegionUi): "view" | "edit" | "hidden" {
    if (ui.selection === null) {
      return "view";
    }
    return projection.columns[ui.selection.col]?.access ?? "view";
  }

  function fieldIdForSelection(ui: RegionUi): string | undefined {
    if (ui.selection === null) {
      return undefined;
    }
    return projection.columns[ui.selection.col]?.fieldId;
  }

  function syncFormulaBar(ui: RegionUi): void {
    ui.formulaAddr.textContent = formatSelection(ui.selection);
    ui.formulaInput.value = formulaBarText(ui.grid, ui.selection);
    ui.session = null;
    const access = accessForSelection(ui);
    const editable = access === "edit";
    ui.formulaInput.readOnly = !editable;
    ui.formulaInput.title = editable
      ? ""
      : `Read-only: ${fieldIdForSelection(ui) ?? "field"} is ${access}`;
  }

  function startSessionFromBar(ui: RegionUi): void {
    if (ui.selection === null || ui.session !== null) {
      return;
    }
    if (accessForSelection(ui) !== "edit") {
      return;
    }
    ui.session = beginEdit(ui.selection, formulaBarText(ui.grid, ui.selection));
  }

  function refreshForm(): void {
    const rowIndex = mainUi.selection?.row ?? 0;
    const record: BoundRow = boundRows[rowIndex] ?? {};
    const form = buildFormView(workspaceLayout, record, effective);
    const label =
      boundRows[rowIndex] === undefined
        ? "form · no row"
        : `form · row ${String(rowIndex + 1)}`;
    formPanelHeader.textContent = label;
    renderFormView(formBody, form);
  }

  function populateUserSelect(users: readonly SamplePermissionUser[]): void {
    userSelect.replaceChildren();
    for (const sample of users) {
      const option = document.createElement("option");
      option.value = sample.id;
      option.textContent = sample.label;
      userSelect.append(option);
    }
    userSelect.value = users[0]?.id ?? "";
  }

  function applyPermissionsFromUser(userId: string): void {
    const sample =
      activeEntry.sampleUsers.find((u) => u.id === userId) ??
      activeEntry.sampleUsers[0];
    if (sample === undefined) {
      return;
    }
    effective = resolvePermissions(activeEntry.permissions, sample.position);
    projection = projectColumnsForPermissions(
      workspaceLayout.main.columns,
      effective,
    );
    lastDeniedMessage = null;

    const paintMain = paintConfigFromPermissionProjection(dims.rows, projection);
    const paintBottom = paintConfigFromPermissionProjection(
      bottomUi.paintBase.rows,
      projection,
    );

    mainUi.grid = remapEditableGrid(mainUi.engineGrid, projection.engineColIndices);
    bottomUi.grid = remapEditableGrid(
      bottomUi.engineGrid,
      projection.engineColIndices,
    );

    mainUi.paintBase = { ...paintMain, chrome: "main" };
    bottomUi.paintBase = { ...paintBottom, chrome: "bottom" };
    mainUi.bounds = { rows: paintMain.rows, cols: paintMain.cols };
    bottomUi.bounds = { rows: paintBottom.rows, cols: paintBottom.cols };

    mainUi.selection =
      mainUi.selection === null
        ? clampSelection({ row: 0, col: 0 }, mainUi.bounds)
        : clampSelection(mainUi.selection, mainUi.bounds);
    bottomUi.selection =
      bottomUi.selection === null
        ? clampSelection({ row: 0, col: 0 }, bottomUi.bounds)
        : clampSelection(bottomUi.selection, bottomUi.bounds);
    mainUi.session = null;
    bottomUi.session = null;

    const bottomOk = isRegionVisible(effective, "bottom");
    bottomPanel.hidden = !bottomOk;
    bottomPanel.setAttribute("aria-hidden", bottomOk ? "false" : "true");

    syncFormulaBar(mainUi);
    syncFormulaBar(bottomUi);
    refreshForm();
    repaintAll();
  }

  function statusLine(): string {
    const sample =
      activeEntry.sampleUsers.find((u) => u.id === userSelect.value) ??
      activeEntry.sampleUsers[0];
    const userBit = sample === undefined ? "" : ` · ${sample.label}`;
    const denied =
      lastDeniedMessage === null ? "" : ` · ${lastDeniedMessage}`;
    const bottomBit = isRegionVisible(effective, "bottom")
      ? ` · bottom ${formatSelection(bottomUi.selection)}`
      : " · bottom denied";
    return `${workspaceLayout.name} · ${String(dims.rows)} ${workspaceLayout.main.dataSource}${userBit} · main ${formatSelection(mainUi.selection)}${bottomBit}${historyHint()}${denied}`;
  }

  function repaintAll(): void {
    if (!isRegionVisible(effective, "main")) {
      status.textContent = `${workspaceLayout.name} · main region denied`;
      return;
    }

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

    if (isRegionVisible(effective, "bottom") && !bottomPanel.hidden) {
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
    }

    status.textContent = statusLine();
  }

  function historyHint(): string {
    if (!rawWorkspace.can_undo() && !rawWorkspace.can_redo()) {
      return "";
    }
    return ` · undo ${rawWorkspace.can_undo() ? "ready" : "—"} / redo ${rawWorkspace.can_redo() ? "ready" : "—"}`;
  }

  function applyHistory(kind: "undo" | "redo"): void {
    mainUi.session = null;
    bottomUi.session = null;
    const changed =
      kind === "undo" ? rawWorkspace.undo() : rawWorkspace.redo();
    if (!changed) {
      return;
    }
    lastDeniedMessage = null;
    syncFormulaBar(mainUi);
    syncFormulaBar(bottomUi);
    repaintAll();
  }

  function commitFromBar(ui: RegionUi, navKey: "Enter" | "Tab" | null): void {
    if (ui.selection === null) {
      return;
    }
    const access = accessForSelection(ui);
    const fieldId = fieldIdForSelection(ui);
    const activeSession =
      ui.session ?? beginEdit(ui.selection, formulaBarText(ui.grid, ui.selection));
    const withDraft = updateDraft(activeSession, ui.formulaInput.value);
    const result = commitEditWithAccess(ui.grid, withDraft, access, fieldId);
    ui.session = null;
    if (!result.ok) {
      lastDeniedMessage = result.message;
      ui.formulaInput.value = formulaBarText(ui.grid, ui.selection);
      repaintAll();
      return;
    }
    lastDeniedMessage = null;
    if (navKey !== null) {
      ui.selection = moveSelection(ui.selection, navKey, ui.bounds);
    }
    syncFormulaBar(ui);
    refreshForm();
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
      lastDeniedMessage = null;
      syncFormulaBar(ui);
      if (ui.region === "main") {
        refreshForm();
      }
      repaintAll();
      ui.canvas.focus();
    });

    ui.canvas.addEventListener("keydown", (event) => {
      const history = historyActionFromKey(event);
      if (history !== null) {
        event.preventDefault();
        applyHistory(history);
        return;
      }
      if (!isSelectionNavKey(event.key)) {
        return;
      }
      event.preventDefault();
      if (ui.session !== null && ui.formulaInput.value !== ui.session.original) {
        commitFromBar(ui, null);
      }
      ui.selection = moveSelection(ui.selection, event.key, ui.bounds);
      lastDeniedMessage = null;
      syncFormulaBar(ui);
      if (ui.region === "main") {
        refreshForm();
      }
      repaintAll();
    });

    ui.formulaInput.addEventListener("focus", () => {
      startSessionFromBar(ui);
    });
    ui.formulaInput.addEventListener("input", () => {
      if (accessForSelection(ui) !== "edit") {
        lastDeniedMessage =
          fieldIdForSelection(ui) === undefined
            ? "Cannot edit — field is not editable."
            : `Cannot edit "${fieldIdForSelection(ui) ?? ""}" — access is view, not edit.`;
        ui.formulaInput.value = formulaBarText(ui.grid, ui.selection);
        status.textContent = statusLine();
        return;
      }
      startSessionFromBar(ui);
      if (ui.session !== null) {
        ui.session = updateDraft(ui.session, ui.formulaInput.value);
      }
    });
    ui.formulaInput.addEventListener("keydown", (event) => {
      const history = historyActionFromKey(event);
      if (history !== null) {
        event.preventDefault();
        applyHistory(history);
        return;
      }
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
    if (!isRegionVisible(effective, "bottom")) {
      lastDeniedMessage = "Cannot access bottom region.";
      status.textContent = statusLine();
      return;
    }
    bottomTabs = selectBottomTab(bottomTabs, tab);
    applyBottomTabUi();
    if (bottomTabs.active === "aggregate") {
      repaintAll();
    } else {
      renderNotesTable();
    }
    status.textContent = `${workspaceLayout.name} · ${String(dims.rows)} ${workspaceLayout.main.dataSource} · bottom tab ${bottomTabs.active}`;
  }

  function seedFromBound(
    layout: WorkspaceLayout,
    grid: BoundMainGrid,
  ): void {
    rawWorkspace = create_workspace();
    mainEngine = asRegionEditableGrid(rawWorkspace, "main");
    bottomEngine = asRegionEditableGrid(rawWorkspace, "bottom");
    mainUi.engineGrid = mainEngine;
    bottomUi.engineGrid = bottomEngine;

    workspaceLayout = layout;
    boundRows = [...grid.rows];
    dims = seedGridFromBoundMain(mainEngine, grid);
    const engineNumeric = engineNumericColumns(workspaceLayout);
    const bottomDims = seedBottomAggregate(
      bottomEngine,
      dims.rows,
      dims.cols,
      engineNumeric,
    );
    rawWorkspace.clear_history();

    mainPanelHeader.textContent = `main · ${layout.main.dataSource}`;
    bottomUi.paintBase = {
      ...bottomUi.paintBase,
      rows: bottomDims.rows,
      cols: bottomDims.cols,
    };
    mainUi.selection =
      dims.rows > 0 ? { row: 0, col: 0 } : null;
    bottomUi.selection =
      bottomDims.rows > 0 ? { row: 0, col: 0 } : null;
    mainUi.session = null;
    bottomUi.session = null;

    bottomTabs = createBottomTabState(layout.bottom.activeTab);
    notesRows = createNotesRows(
      layout.bottom.notes.fields.map((field) => ({
        label: field.name,
        value: "",
      })),
    );
  }

  async function activateWorkspace(entryId: string): Promise<void> {
    const entry =
      DEMO_WORKSPACES.find((w) => w.id === entryId) ?? DEMO_WORKSPACES[0];
    if (entry === undefined) {
      return;
    }
    activeEntry = entry;
    status.textContent = `Loading ${entry.definition.name}…`;

    const loaded = await loadWorkspaceMain(entry.definition);
    if (!loaded.ok) {
      status.textContent = `Failed to load ${entry.definition.regions.main.dataSource}: ${loaded.error.message}. Is the mock server on :4000? (make up)`;
      return;
    }

    populateUserSelect(entry.sampleUsers);
    seedFromBound(loaded.layout, loaded.grid);
    applyBottomTabUi();
    renderNotesTable();
    applyPermissionsFromUser(userSelect.value);
    mainUi.canvas.focus();
  }

  wireRegion(mainUi);
  wireRegion(bottomUi);

  userSelect.addEventListener("change", () => {
    applyPermissionsFromUser(userSelect.value);
  });

  workspaceSelect.addEventListener("change", () => {
    void activateWorkspace(workspaceSelect.value);
  });

  tabAggregate.addEventListener("click", () => {
    switchBottomTab("aggregate");
  });
  tabNotes.addEventListener("click", () => {
    switchBottomTab("notes");
  });
  bottomAddRow.addEventListener("click", () => {
    if (!isRegionVisible(effective, "bottom")) {
      lastDeniedMessage = "Cannot access bottom region.";
      status.textContent = statusLine();
      return;
    }
    const target = bottomControlTarget(bottomTabs);
    if (target === "notes") {
      notesRows = addNotesRow(notesRows);
      renderNotesTable();
      return;
    }
    const nextRow = bottomUi.paintBase.rows;
    bottomUi.engineGrid.set_cell(nextRow, 0, "");
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

  await activateWorkspace(workspaceSelect.value);
}

main().catch((err: unknown) => {
  const status = document.getElementById("status");
  if (status !== null) {
    status.textContent = `Failed: ${String(err)}`;
  }
  console.error(err);
});
