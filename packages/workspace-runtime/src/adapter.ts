/**
 * Transport-agnostic data adapter surface.
 *
 * Concrete adapters (REST, GraphQL, …) implement {@link DataAdapter}.
 * Callers bind results with {@link bindRecordsToMainGrid} / {@link loadMainGrid}.
 */

import { bindRecordsToMainGrid, type BoundMainGrid } from "./binding.js";
import type { WorkspaceLayout } from "./types.js";

export type DataAdapterErrorCode = "network" | "http" | "invalid_payload" | "unknown";

/** Typed failure from a data adapter — never an unhandled rejection. */
export interface DataAdapterError {
  code: DataAdapterErrorCode;
  message: string;
  /** HTTP status when `code` is `http`. */
  status?: number;
  /** Collection / data-source name involved in the failure. */
  collection?: string;
}

export type FetchRecordsResult =
  | { ok: true; records: unknown[] }
  | { ok: false; error: DataAdapterError };

/**
 * Reads collections of data objects. No transport types (URL, Response,
 * GraphQL documents, …) appear on this interface.
 */
export interface DataAdapter {
  /**
   * Loads every record for `collection` (e.g. `"loans"`).
   *
   * Implementations must catch transport failures and return
   * `{ ok: false, error }` instead of rejecting.
   */
  fetchRecords(collection: string): Promise<FetchRecordsResult>;
}

export type LoadMainGridResult =
  | { ok: true; grid: BoundMainGrid }
  | { ok: false; error: DataAdapterError };

/**
 * Fetches `layout.main.dataSource` through `adapter` and projects rows
 * onto the main-region columns.
 */
export async function loadMainGrid(
  adapter: DataAdapter,
  layout: WorkspaceLayout,
): Promise<LoadMainGridResult> {
  const fetched = await adapter.fetchRecords(layout.main.dataSource);
  if (!fetched.ok) {
    return fetched;
  }
  const bound = bindRecordsToMainGrid(fetched.records, layout);
  if (!bound.ok) {
    return {
      ok: false,
      error: {
        code: "invalid_payload",
        message: bound.error.message,
        collection: layout.main.dataSource,
      },
    };
  }
  return { ok: true, grid: bound.grid };
}
