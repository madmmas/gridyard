import { asGridDataSource } from "./source.js";
import type { EditableGrid } from "./edit.js";
import type { GridDataSource } from "./types.js";

/** Named workspace regions exposed by `gridyard-wasm` `Workspace`. */
export type WorkspaceRegion = "main" | "bottom";

/**
 * Surface matching `gridyard-wasm` `Workspace` cell APIs (region-addressed).
 */
export interface RegionWorkspace {
  get_cell(region: string, row: number, col: number): unknown;
  get_input(region: string, row: number, col: number): string;
  set_cell(region: string, row: number, col: number, input: string): void;
}

/**
 * Wraps a multi-region workspace as a {@link GridDataSource} pinned to
 * one region — for `paintStaticGrid` on main or bottom Aggregate.
 */
export function asRegionDataSource(
  workspace: Pick<RegionWorkspace, "get_cell">,
  region: WorkspaceRegion,
): GridDataSource {
  return asGridDataSource({
    get_cell(row: number, col: number): unknown {
      return workspace.get_cell(region, row, col);
    },
  });
}

/**
 * Wraps a multi-region workspace as an {@link EditableGrid} pinned to
 * one region — for formula-bar selection / commit on that region's canvas.
 */
export function asRegionEditableGrid(
  workspace: RegionWorkspace,
  region: WorkspaceRegion,
): EditableGrid {
  const source = asRegionDataSource(workspace, region);
  return {
    get_cell(row: number, col: number) {
      return source.get_cell(row, col);
    },
    get_input(row: number, col: number): string {
      return workspace.get_input(region, row, col);
    },
    set_cell(row: number, col: number, input: string): void {
      workspace.set_cell(region, row, col, input);
    },
  };
}
