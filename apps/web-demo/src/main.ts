import {
  addNotesRow,
  asRegionEditableGrid,
  beginEdit,
  beginEditFromCanvasStart,
  beginSearch,
  bottomControlTarget,
  cancelEdit,
  canvasEditStartFromKey,
  clampSelection,
  clearSearch,
  colIndexToLetters,
  commitEditWithAccess,
  computeBottomLayoutFromMain,
  computeGridLayout,
  createBottomTabState,
  createNotesRows,
  createPaintScheduler,
  formulaBarText,
  hitTestColumnResizeEdge,
  hitTestDataCell,
  isSelectionNavKey,
  moveSelection,
  nextSearchMatch,
  paintStaticGrid,
  prevSearchMatch,
  remapEditableGrid,
  activeSearchMatch,
  scrollTopToRevealRow,
  selectBottomTab,
  updateDraft,
  updateNotesRow,
  viewportBodyHeight,
  type BottomTabState,
  type CanvasEditStart,
  type CellAddress,
  type EditSession,
  type EditableGrid,
  type GridLayout,
  type NotesRow,
  type SearchState,
  type WorkspaceRegion,
} from "@gridyard/grid-renderer";
import {
  EMPLOYEE_MANAGEMENT_PERMISSIONS,
  EMPLOYEE_MANAGEMENT_SAMPLE_USERS,
  EMPLOYEE_MANAGEMENT_WORKSPACE,
  LOAN_REVIEW_PERMISSIONS,
  LOAN_REVIEW_SAMPLE_USERS,
  LOAN_REVIEW_WORKSPACE,
  isRegionVisible,
  projectColumnsForPermissions,
  resolvePermissions,
  type BoundMainGrid,
  type EffectivePermissions,
  type LayeredPermissionDefinition,
  type PermissionColumnProjection,
  type SamplePermissionUser,
  type WorkspaceDefinition,
  type WorkspaceLayout,
} from "@gridyard/workspace-runtime";

import { historyActionFromKey } from "./history-keys.js";
import {
  tryColumnResizeDrag,
  tryResetSharedColumnWidths,
} from "./layout-resize-chrome.js";
import { loadWorkspaceMain } from "./load-workspace.js";
import {
  paintViewportFromScrollHost,
  sizeScrollSpacer,
} from "./scroll-host.js";
import {
  formatSearchStatus,
  revealActiveSearchMatch,
} from "./search-chrome.js";
import {
  engineNumericColumns,
  paintConfigFromPermissionProjection,
  seedBottomAggregate,
  seedGridFromBoundMain,
} from "./seed-from-bound-grid.js";
import {
  SYNTHETIC_LOAN_ROW_COUNT,
  generateSyntheticLoans,
} from "./synthetic-loans.js";
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
  const tabAggregateEl = document.getElementById("tab-aggregate");
  const tabNotesEl = document.getElementById("tab-notes");
  const panelAggregateEl = document.getElementById("panel-aggregate");
  const panelNotesEl = document.getElementById("panel-notes");
  const notesBodyEl = document.getElementById("notes-body");
  const bottomAddRowEl = document.getElementById("bottom-add-row");
  const bottomPanelEl = document.getElementById("bottom-panel");
  const userSelectEl = document.getElementById("demo-user");
  const mainScrollHostEl = document.getElementById("main-scroll-host");
  const mainScrollSpacerEl = document.getElementById("main-scroll-spacer");
  const largeDatasetEl = document.getElementById("large-dataset");
  const resetSharedLayoutEl = document.getElementById("reset-shared-layout");
  const mainSearchInputEl = document.getElementById("main-search-input");
  const mainSearchStatusEl = document.getElementById("main-search-status");
  const mainSearchPrevEl = document.getElementById("main-search-prev");
  const mainSearchNextEl = document.getElementById("main-search-next");
  const mainSearchClearEl = document.getElementById("main-search-clear");
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
    !(tabAggregateEl instanceof HTMLButtonElement) ||
    !(tabNotesEl instanceof HTMLButtonElement) ||
    panelAggregateEl === null ||
    panelNotesEl === null ||
    notesBodyEl === null ||
    !(bottomAddRowEl instanceof HTMLButtonElement) ||
    bottomPanelEl === null ||
    !(userSelectEl instanceof HTMLSelectElement) ||
    !(mainScrollHostEl instanceof HTMLElement) ||
    !(mainScrollSpacerEl instanceof HTMLElement) ||
    !(largeDatasetEl instanceof HTMLInputElement) ||
    !(resetSharedLayoutEl instanceof HTMLButtonElement) ||
    !(mainSearchInputEl instanceof HTMLInputElement) ||
    mainSearchStatusEl === null ||
    !(mainSearchPrevEl instanceof HTMLButtonElement) ||
    !(mainSearchNextEl instanceof HTMLButtonElement) ||
    !(mainSearchClearEl instanceof HTMLButtonElement)
  ) {
    throw new Error(
      "expected main/bottom grid + scroll host + search chrome + formula bar + tabs + workspace/user elements",
    );
  }
  const status: HTMLElement = statusEl;
  const workspaceSelect = workspaceSelectEl;
  const mainPanelHeader = mainPanelHeaderEl;
  const tabAggregate = tabAggregateEl;
  const tabNotes = tabNotesEl;
  const panelAggregate = panelAggregateEl;
  const panelNotes = panelNotesEl;
  const notesBody = notesBodyEl;
  const bottomAddRow = bottomAddRowEl;
  const bottomPanel = bottomPanelEl;
  const userSelect = userSelectEl;
  const mainScrollHost = mainScrollHostEl;
  const mainScrollSpacer = mainScrollSpacerEl;
  const largeDataset = largeDatasetEl;
  const resetSharedLayout = resetSharedLayoutEl;
  const mainSearchInput = mainSearchInputEl;
  const mainSearchStatus = mainSearchStatusEl;
  const mainSearchPrev = mainSearchPrevEl;
  const mainSearchNext = mainSearchNextEl;
  const mainSearchClear = mainSearchClearEl;
  const mainCtx = mainCanvasEl.getContext("2d");
  const bottomCtx = bottomCanvasEl.getContext("2d");
  if (mainCtx === null || bottomCtx === null) {
    throw new Error("2d context unavailable");
  }

  const paintScheduler = createPaintScheduler();
  let mainSearch: SearchState = clearSearch();

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
  let dims = { rows: 0, cols: 0 };
  let effective!: EffectivePermissions;
  let projection!: PermissionColumnProjection;
  let lastDeniedMessage: string | null = null;
  /** Factory default widths for the current projection (shared-layout reset). */
  let sharedDefaultWidths: number[] = [];
  type ColumnResizeDrag = {
    col: number;
    startX: number;
    startWidths: number[];
  };
  let columnResizeDrag: ColumnResizeDrag | null = null;

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

  /**
   * Focuses the formula bar from a canvas gesture (type-over / F2 / dblclick).
   * Type-over replaces the draft with the typed character; F2 and double-click
   * keep the existing cell input and place the caret at the end.
   */
  function focusFormulaBarForEdit(ui: RegionUi, start: CanvasEditStart): void {
    if (ui.selection === null) {
      return;
    }
    if (accessForSelection(ui) !== "edit") {
      const fieldId = fieldIdForSelection(ui);
      lastDeniedMessage =
        fieldId === undefined
          ? "Cannot edit — field is not editable."
          : `Cannot edit "${fieldId}" — access is view, not edit.`;
      status.textContent = statusLine();
      return;
    }
    const original = formulaBarText(ui.grid, ui.selection);
    ui.session = beginEditFromCanvasStart(ui.selection, original, start);
    ui.formulaInput.readOnly = false;
    ui.formulaInput.title = "";
    ui.formulaInput.value = ui.session.draft;
    ui.formulaInput.focus();
    const caret = ui.formulaInput.value.length;
    ui.formulaInput.setSelectionRange(caret, caret);
    lastDeniedMessage = null;
    status.textContent = statusLine();
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
    sharedDefaultWidths = [...paintMain.columnWidths];
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
    if (mainSearchInput.value.length > 0) {
      mainSearch = beginSearch({
        source: mainUi.grid,
        rows: mainUi.bounds.rows,
        cols: mainUi.bounds.cols,
        query: mainSearchInput.value,
      });
      syncSearchChrome();
    }
    scheduleRepaint();
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
    const sizeBit =
      activeEntry.id === "loan-review" && largeDataset.checked
        ? " · virtualized"
        : "";
    const searchBit =
      mainSearch.query.length === 0
        ? ""
        : ` · find ${formatSearchStatus(mainSearch)}`;
    return `${workspaceLayout.name} · ${String(dims.rows)} ${workspaceLayout.main.dataSource}${sizeBit}${userBit} · main ${formatSelection(mainUi.selection)}${bottomBit}${searchBit}${historyHint()}${denied}`;
  }

  function syncSearchChrome(): void {
    mainSearchStatus.textContent = formatSearchStatus(mainSearch);
    const hasMatches = mainSearch.matches.length > 0;
    const hasQuery = mainSearch.query.length > 0;
    mainSearchPrev.disabled = !hasMatches;
    mainSearchNext.disabled = !hasMatches;
    mainSearchClear.disabled = !hasQuery;
  }

  function probeMainLayout(): GridLayout {
    return computeGridLayout({
      rows: mainUi.paintBase.rows,
      cols: mainUi.paintBase.cols,
      columnWidths: mainUi.paintBase.columnWidths,
    });
  }

  function revealMainSearchMatch(): void {
    revealActiveSearchMatch({
      host: mainScrollHost,
      layout: probeMainLayout(),
      state: mainSearch,
      totalRows: mainUi.bounds.rows,
    });
  }

  function runMainSearch(query: string, options?: { reveal?: boolean }): void {
    mainSearch = beginSearch({
      source: mainUi.grid,
      rows: mainUi.bounds.rows,
      cols: mainUi.bounds.cols,
      query,
    });
    syncSearchChrome();
    if (options?.reveal !== false) {
      revealMainSearchMatch();
    }
    scheduleRepaint();
  }

  function clearMainSearch(options?: { repaint?: boolean }): void {
    mainSearch = clearSearch();
    mainSearchInput.value = "";
    syncSearchChrome();
    if (options?.repaint !== false) {
      scheduleRepaint();
    }
  }

  /** Scroll the main host so the current main selection row is fully visible. */
  function ensureMainSelectionVisible(): void {
    if (mainUi.selection === null) {
      return;
    }
    const probe = probeMainLayout();
    const bodyH = viewportBodyHeight(
      mainScrollHost.clientHeight,
      probe.headerHeight,
    );
    const next = scrollTopToRevealRow(
      mainUi.selection.row,
      probe.rowHeight,
      bodyH,
      mainUi.bounds.rows,
      mainScrollHost.scrollTop,
    );
    if (next !== mainScrollHost.scrollTop) {
      mainScrollHost.scrollTop = next;
    }
  }

  function paintMainRegion(): void {
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

    const viewport = paintViewportFromScrollHost(mainScrollHost);
    sizeScrollSpacer(
      mainScrollSpacer,
      mainLayout.totalWidth,
      mainLayout.totalHeight,
    );
    mainUi.canvas.width = Math.max(mainLayout.totalWidth, 1);
    mainUi.canvas.height = Math.max(viewport.height, 1);
    mainUi.layout = paintStaticGrid(mainUi.ctx, {
      ...mainUi.paintBase,
      source: mainUi.grid,
      selection: mainUi.selection,
      viewport,
      searchMatches: mainSearch.matches,
      activeSearchMatch: activeSearchMatch(mainSearch),
    });
  }

  function paintBottomRegion(): void {
    if (!isRegionVisible(effective, "bottom") || bottomPanel.hidden) {
      return;
    }
    const layout = paintStaticGrid(bottomUi.ctx, {
      ...bottomUi.paintBase,
      source: bottomUi.grid,
      selection: bottomUi.selection,
    });
    bottomUi.canvas.width = layout.totalWidth;
    bottomUi.canvas.height = layout.totalHeight;
    bottomUi.layout = paintStaticGrid(bottomUi.ctx, {
      ...bottomUi.paintBase,
      source: bottomUi.grid,
      selection: bottomUi.selection,
    });
  }

  function scheduleRepaint(): void {
    if (!isRegionVisible(effective, "main")) {
      status.textContent = `${workspaceLayout.name} · main region denied`;
      return;
    }
    paintScheduler.schedule("main", () => {
      paintMainRegion();
      status.textContent = statusLine();
    });
    if (isRegionVisible(effective, "bottom") && !bottomPanel.hidden) {
      paintScheduler.schedule("bottom", () => {
        paintBottomRegion();
      });
    }
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
    scheduleRepaint();
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
      scheduleRepaint();
      return;
    }
    lastDeniedMessage = null;
    if (navKey !== null) {
      ui.selection = moveSelection(ui.selection, navKey, ui.bounds);
      if (ui.region === "main") {
        ensureMainSelectionVisible();
      }
    }
    syncFormulaBar(ui);
    if (ui.region === "main" && mainSearch.query.length > 0) {
      mainSearch = beginSearch({
        source: mainUi.grid,
        rows: mainUi.bounds.rows,
        cols: mainUi.bounds.cols,
        query: mainSearch.query,
      });
      syncSearchChrome();
    }
    // Main edits must refresh bottom Aggregate (cross-region reads).
    scheduleRepaint();
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
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;

      if (ui.region === "main") {
        const edge = hitTestColumnResizeEdge(ui.layout, localX, localY);
        if (edge !== null) {
          event.preventDefault();
          const attempt = tryColumnResizeDrag(
            effective,
            mainUi.paintBase.columnWidths,
            edge,
            0,
          );
          if (!attempt.ok) {
            lastDeniedMessage = attempt.message;
            status.textContent = statusLine();
            return;
          }
          columnResizeDrag = {
            col: edge,
            startX: event.clientX,
            startWidths: [...mainUi.paintBase.columnWidths],
          };
          lastDeniedMessage = null;
          ui.canvas.setPointerCapture(event.pointerId);
          ui.canvas.style.cursor = "col-resize";
          return;
        }
      }

      const scrollTop =
        ui.region === "main" ? mainScrollHost.scrollTop : 0;
      const hit = hitTestDataCell(
        ui.layout,
        localX,
        localY,
        ui.bounds,
        scrollTop,
      );
      if (hit === null) {
        return;
      }
      ui.selection = hit;
      lastDeniedMessage = null;
      syncFormulaBar(ui);
      scheduleRepaint();
      ui.canvas.focus();
    });

    if (ui.region === "main") {
      ui.canvas.addEventListener("pointermove", (event) => {
        if (ui.layout === null) {
          return;
        }
        if (columnResizeDrag !== null) {
          const delta = event.clientX - columnResizeDrag.startX;
          const attempt = tryColumnResizeDrag(
            effective,
            columnResizeDrag.startWidths,
            columnResizeDrag.col,
            delta,
          );
          if (!attempt.ok) {
            lastDeniedMessage = attempt.message;
            status.textContent = statusLine();
            return;
          }
          mainUi.paintBase = {
            ...mainUi.paintBase,
            columnWidths: attempt.widths,
          };
          scheduleRepaint();
          return;
        }
        const rect = ui.canvas.getBoundingClientRect();
        const edge = hitTestColumnResizeEdge(
          ui.layout,
          event.clientX - rect.left,
          event.clientY - rect.top,
        );
        ui.canvas.style.cursor =
          edge !== null && effective.layout.canResize ? "col-resize" : "cell";
      });

      ui.canvas.addEventListener("pointerup", (event) => {
        if (columnResizeDrag === null) {
          return;
        }
        columnResizeDrag = null;
        if (ui.canvas.hasPointerCapture(event.pointerId)) {
          ui.canvas.releasePointerCapture(event.pointerId);
        }
        ui.canvas.style.cursor = "cell";
        status.textContent = statusLine();
      });

      ui.canvas.addEventListener("pointercancel", () => {
        columnResizeDrag = null;
        ui.canvas.style.cursor = "cell";
      });
    }

    ui.canvas.addEventListener("dblclick", (event) => {
      if (ui.layout === null || ui.selection === null) {
        return;
      }
      event.preventDefault();
      focusFormulaBarForEdit(ui, { kind: "edit-existing" });
    });

    ui.canvas.addEventListener("keydown", (event) => {
      const history = historyActionFromKey(event);
      if (history !== null) {
        event.preventDefault();
        applyHistory(history);
        return;
      }
      const editStart = canvasEditStartFromKey(event);
      if (editStart !== null) {
        event.preventDefault();
        focusFormulaBarForEdit(ui, editStart);
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
      if (ui.region === "main") {
        ensureMainSelectionVisible();
      }
      lastDeniedMessage = null;
      syncFormulaBar(ui);
      scheduleRepaint();
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
      scheduleRepaint();
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
    largeDataset.disabled = entry.id !== "loan-review";
    if (entry.id !== "loan-review") {
      largeDataset.checked = false;
    }

    const useSynthetic =
      entry.id === "loan-review" && largeDataset.checked;
    const grid = useSynthetic
      ? generateSyntheticLoans(SYNTHETIC_LOAN_ROW_COUNT)
      : loaded.grid;
    seedFromBound(loaded.layout, grid);
    mainScrollHost.scrollTop = 0;
    clearMainSearch({ repaint: false });
    applyBottomTabUi();
    renderNotesTable();
    applyPermissionsFromUser(userSelect.value);
    mainUi.canvas.focus();
  }

  wireRegion(mainUi);
  wireRegion(bottomUi);
  syncSearchChrome();

  mainSearchInput.addEventListener("input", () => {
    runMainSearch(mainSearchInput.value);
  });
  mainSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (mainSearch.matches.length === 0) {
        runMainSearch(mainSearchInput.value);
        return;
      }
      mainSearch = event.shiftKey
        ? prevSearchMatch(mainSearch)
        : nextSearchMatch(mainSearch);
      syncSearchChrome();
      revealMainSearchMatch();
      scheduleRepaint();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      clearMainSearch();
    }
  });
  mainSearchNext.addEventListener("click", () => {
    if (mainSearch.matches.length === 0) {
      return;
    }
    mainSearch = nextSearchMatch(mainSearch);
    syncSearchChrome();
    revealMainSearchMatch();
    scheduleRepaint();
  });
  mainSearchPrev.addEventListener("click", () => {
    if (mainSearch.matches.length === 0) {
      return;
    }
    mainSearch = prevSearchMatch(mainSearch);
    syncSearchChrome();
    revealMainSearchMatch();
    scheduleRepaint();
  });
  mainSearchClear.addEventListener("click", () => {
    clearMainSearch();
  });

  mainScrollHost.addEventListener(
    "scroll",
    () => {
      paintScheduler.schedule("main", () => {
        paintMainRegion();
        status.textContent = statusLine();
      });
    },
    { passive: true },
  );

  largeDataset.addEventListener("change", () => {
    if (activeEntry.id !== "loan-review") {
      return;
    }
    void activateWorkspace(activeEntry.id);
  });

  userSelect.addEventListener("change", () => {
    applyPermissionsFromUser(userSelect.value);
  });

  resetSharedLayout.addEventListener("click", () => {
    const attempt = tryResetSharedColumnWidths(effective, sharedDefaultWidths);
    if (!attempt.ok) {
      lastDeniedMessage = attempt.message;
      status.textContent = statusLine();
      return;
    }
    lastDeniedMessage = null;
    mainUi.paintBase = {
      ...mainUi.paintBase,
      columnWidths: attempt.widths,
    };
    scheduleRepaint();
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
    scheduleRepaint();
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
