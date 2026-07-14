/**
 * REST implementation of {@link DataAdapter}.
 *
 * Transport details (base URL, `fetch`) stay on the constructor options —
 * they do not leak into {@link DataAdapter}.
 */

import type { DataAdapter, FetchRecordsResult } from "./adapter.js";

export interface RestDataAdapterOptions {
  /** Origin of the mock/real API, e.g. `http://localhost:4000`. */
  baseUrl: string;
  /**
   * Injectable fetch for tests. Defaults to global `fetch`.
   * Typed without importing DOM `Response` into the adapter interface.
   */
  fetchImpl?: typeof fetch;
}

/**
 * Creates a {@link DataAdapter} that GETs `{baseUrl}/{collection}`
 * (json-server style, matching `apps/mock-server`).
 */
export function createRestDataAdapter(options: RestDataAdapterOptions): DataAdapter {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);

  return {
    async fetchRecords(collection: string): Promise<FetchRecordsResult> {
      const name = collection.trim();
      if (name === "") {
        return {
          ok: false,
          error: {
            code: "invalid_payload",
            message: "collection name must be a non-empty string",
            collection: name,
          },
        };
      }

      const url = `${baseUrl}/${encodeURIComponent(name)}`;
      let response: Response;
      try {
        response = await fetchImpl(url);
      } catch (cause: unknown) {
        return {
          ok: false,
          error: {
            code: "network",
            message: `network request failed for ${url}: ${formatCause(cause)}`,
            collection: name,
          },
        };
      }

      if (!response.ok) {
        return {
          ok: false,
          error: {
            code: "http",
            status: response.status,
            message: `HTTP ${String(response.status)} fetching ${url}`,
            collection: name,
          },
        };
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch (cause: unknown) {
        return {
          ok: false,
          error: {
            code: "invalid_payload",
            message: `response from ${url} was not valid JSON: ${formatCause(cause)}`,
            collection: name,
          },
        };
      }

      if (!Array.isArray(body)) {
        return {
          ok: false,
          error: {
            code: "invalid_payload",
            message: `expected a JSON array from ${url}`,
            collection: name,
          },
        };
      }

      return { ok: true, records: body };
    },
  };
}

function formatCause(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }
  return String(cause);
}
