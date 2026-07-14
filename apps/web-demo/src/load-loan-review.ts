/**
 * Loads the loan-review workspace definition and binds `/loans` through
 * the REST adapter into a {@link BoundMainGrid}.
 */

import {
  LOAN_REVIEW_WORKSPACE,
  createRestDataAdapter,
  loadMainGrid,
  parseWorkspaceDefinition,
  type BoundMainGrid,
  type DataAdapter,
  type DataAdapterError,
  type WorkspaceLayout,
} from "@gridyard/workspace-runtime";

export type LoadLoanReviewResult =
  | { ok: true; layout: WorkspaceLayout; grid: BoundMainGrid }
  | { ok: false; error: DataAdapterError | { code: string; message: string } };

export interface LoadLoanReviewOptions {
  /** Origin for the mock API (empty string → same-origin `/loans` via Vite proxy). */
  baseUrl?: string;
  /** Injectable adapter for tests. */
  adapter?: DataAdapter;
}

/**
 * Parse the loan-review fixture and fetch/bind its main data source.
 */
export async function loadLoanReviewMain(
  options: LoadLoanReviewOptions = {},
): Promise<LoadLoanReviewResult> {
  const parsed = parseWorkspaceDefinition(LOAN_REVIEW_WORKSPACE);
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
