import { asGridDataSource } from "./source.js";
import type { CellAddress } from "./selection.js";
import type { GridDataSource } from "./types.js";

/**
 * Mutable grid surface used by the formula bar / edit commit path.
 * Matches `gridyard-wasm`'s `Grid` plus `get_input`.
 */
export interface EditableGrid extends GridDataSource {
  get_input(row: number, col: number): string;
  set_cell(row: number, col: number, input: string): void;
}

/** In-progress formula-bar edit for a single cell. */
export interface EditSession {
  address: CellAddress;
  /** Text currently shown in the formula bar. */
  draft: string;
  /** Raw input when the edit began (used to restore on cancel). */
  original: string;
}

/**
 * Starts an edit session for `address` with the given raw `original` input.
 */
export function beginEdit(address: CellAddress, original: string): EditSession {
  return { address, draft: original, original };
}

/**
 * Updates the in-progress draft text without touching the grid.
 */
export function updateDraft(session: EditSession, draft: string): EditSession {
  return { ...session, draft };
}

/**
 * Cancels an in-progress edit. Does not call `set_cell`; returns the
 * original input for the formula bar to restore.
 */
export function cancelEdit(session: EditSession): { address: CellAddress; input: string } {
  return { address: session.address, input: session.original };
}

/**
 * Commits `session.draft` via `grid.set_cell`. Returns the committed
 * address/input so callers can sync the formula bar and repaint.
 *
 * Invalid formulas must not throw from the grid — the WASM/engine path
 * stores an error value that `get_cell` can render.
 */
export function commitEdit(
  grid: EditableGrid,
  session: EditSession,
): { address: CellAddress; input: string } {
  const input = session.draft;
  grid.set_cell(session.address.row, session.address.col, input);
  return { address: session.address, input };
}

/**
 * Field-level access for edit gating. Mirrors workspace-runtime’s
 * `FieldAccess` without taking a package dependency.
 */
export type EditFieldAccess = "view" | "edit" | "hidden";

/**
 * Outcome of a permission-gated commit. Denial never calls `set_cell`.
 */
export type CommitEditResult =
  | { ok: true; address: CellAddress; input: string }
  | {
      ok: false;
      reason: "permission-denied";
      access: EditFieldAccess;
      fieldId?: string;
      message: string;
    };

/**
 * Commits only when `access === "edit"`. View / hidden attempts return a
 * clear denial signal instead of a silent no-op or crash.
 */
export function commitEditWithAccess(
  grid: EditableGrid,
  session: EditSession,
  access: EditFieldAccess,
  fieldId?: string,
): CommitEditResult {
  if (access !== "edit") {
    const label = fieldId === undefined ? "field" : `"${fieldId}"`;
    return {
      ok: false,
      reason: "permission-denied",
      access,
      fieldId,
      message:
        access === "hidden"
          ? `Cannot edit hidden ${label}.`
          : `Cannot edit ${label} — access is view, not edit.`,
    };
  }
  const committed = commitEdit(grid, session);
  return { ok: true, ...committed };
}

/**
 * Reads the formula-bar text for the active selection from the grid.
 * Empty selection → `""`.
 */
export function formulaBarText(grid: EditableGrid, selection: CellAddress | null): string {
  if (selection === null) {
    return "";
  }
  return grid.get_input(selection.row, selection.col);
}

/**
 * Wraps a WASM `Grid` (or test double) as an {@link EditableGrid},
 * normalizing `get_cell` payloads.
 */
export function asEditableGrid(grid: {
  get_cell(row: number, col: number): unknown;
  get_input(row: number, col: number): string;
  set_cell(row: number, col: number, input: string): void;
}): EditableGrid {
  const source = asGridDataSource(grid);
  return {
    get_cell(row: number, col: number) {
      return source.get_cell(row, col);
    },
    get_input(row: number, col: number): string {
      return grid.get_input(row, col);
    },
    set_cell(row: number, col: number, input: string): void {
      grid.set_cell(row, col, input);
    },
  };
}
