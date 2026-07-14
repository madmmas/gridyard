/**
 * Parse a workspace definition and bind its main data source through
 * the REST adapter (or an injected adapter) into a {@link BoundMainGrid}.
 *
 * Domain-agnostic: works for Loan Review, Employee Management, etc.
 */

import {
  createRestDataAdapter,
  loadMainGrid,
  parseWorkspaceDefinition,
  type BoundMainGrid,
  type DataAdapter,
  type DataAdapterError,
  type WorkspaceDefinition,
  type WorkspaceLayout,
} from "@gridyard/workspace-runtime";

export type LoadWorkspaceResult =
  | { ok: true; layout: WorkspaceLayout; grid: BoundMainGrid }
  | { ok: false; error: DataAdapterError | { code: string; message: string } };

export interface LoadWorkspaceOptions {
  /** Origin for the mock API (empty string → same-origin via Vite proxy). */
  baseUrl?: string;
  /** Injectable adapter for tests. */
  adapter?: DataAdapter;
}

/**
 * Parse `definition` and fetch/bind `layout.main.dataSource`.
 */
export async function loadWorkspaceMain(
  definition: WorkspaceDefinition,
  options: LoadWorkspaceOptions = {},
): Promise<LoadWorkspaceResult> {
  const parsed = parseWorkspaceDefinition(definition);
  if (!parsed.ok) {
    const first = parsed.errors[0];
    return {
      ok: false,
      error: {
        code: first?.code ?? "invalid_workspace",
        message:
          first?.message ??
          `workspace schema invalid (${String(parsed.errors.length)} errors)`,
      },
    };
  }

  const adapter =
    options.adapter ??
    createRestDataAdapter({
      baseUrl: options.baseUrl ?? "",
    });

  const loaded = await loadMainGrid(adapter, parsed.layout);
  if (!loaded.ok) {
    return loaded;
  }

  return { ok: true, layout: parsed.layout, grid: loaded.grid };
}
