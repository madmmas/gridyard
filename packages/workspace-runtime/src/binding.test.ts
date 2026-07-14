import { describe, expect, it } from "vitest";

import { loadMainGrid } from "./adapter.js";
import {
  bindRecordsToMainGrid,
  resolveBindingPath,
} from "./binding.js";
import { LOAN_REVIEW_WORKSPACE } from "./fixtures/loan-review.js";
import { parseWorkspaceDefinition } from "./parse.js";
import { createRestDataAdapter } from "./rest-adapter.js";

const loansFixture = [
  {
    id: 1,
    borrower: "Alam Textiles",
    overdue: 8400,
    status: "Overdue",
    daysLate: 14,
    notes: "Called, no answer",
    docLink: "call-log.pdf",
  },
  {
    id: 2,
    borrower: "Nirvana Foods",
    overdue: 2100,
    status: "Active",
    daysLate: 0,
    notes: null,
    docLink: null,
  },
];

function loanReviewLayout() {
  const parsed = parseWorkspaceDefinition(LOAN_REVIEW_WORKSPACE);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    throw new Error("fixture layout failed to parse");
  }
  return parsed.layout;
}

describe("resolveBindingPath", () => {
  it("reads top-level and nested fields", () => {
    expect(resolveBindingPath({ borrower: "Ada" }, "borrower")).toBe("Ada");
    expect(resolveBindingPath({ customer: { name: "Ada" } }, "customer.name")).toBe(
      "Ada",
    );
    expect(resolveBindingPath({ borrower: "Ada" }, "missing")).toBeNull();
  });
});

describe("bindRecordsToMainGrid", () => {
  it("projects loans records onto the loan-review layout", () => {
    const layout = loanReviewLayout();
    const result = bindRecordsToMainGrid(loansFixture, layout);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.grid.dataSource).toBe("loans");
    expect(result.grid.rows).toHaveLength(2);
    expect(result.grid.rows[0]).toEqual({
      borrower: "Alam Textiles",
      overdue: 8400,
      status: "Overdue",
      daysLate: 14,
    });
    expect(result.grid.cells[0]).toEqual(["Alam Textiles", 8400, "Overdue", 14]);
    expect(result.grid.cells[1]).toEqual(["Nirvana Foods", 2100, "Active", 0]);
  });

  it("returns a typed error for a non-array payload", () => {
    const layout = loanReviewLayout();
    const result = bindRecordsToMainGrid({ not: "array" }, layout);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("not_array");
  });
});

describe("createRestDataAdapter", () => {
  it("fetches /loans and loadMainGrid shapes data for the layout", async () => {
    const layout = loanReviewLayout();
    const fetchImpl: typeof fetch = (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      expect(url).toBe("http://localhost:4000/loans");
      return Promise.resolve(
        new Response(JSON.stringify(loansFixture), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    };

    const adapter = createRestDataAdapter({
      baseUrl: "http://localhost:4000/",
      fetchImpl,
    });

    const result = await loadMainGrid(adapter, layout);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.grid.rows).toHaveLength(2);
    expect(result.grid.rows[0]?.["borrower"]).toBe("Alam Textiles");
    expect(result.grid.cells[1]?.[2]).toBe("Active");
  });

  it("surfaces HTTP failures as typed errors (no throw)", async () => {
    const adapter = createRestDataAdapter({
      baseUrl: "http://localhost:4000",
      fetchImpl: () => Promise.resolve(new Response("missing", { status: 404 })),
    });
    const result = await adapter.fetchRecords("loans");
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("http");
    expect(result.error.status).toBe(404);
    expect(result.error.collection).toBe("loans");
  });

  it("surfaces network failures as typed errors (no throw)", async () => {
    const adapter = createRestDataAdapter({
      baseUrl: "http://localhost:4000",
      fetchImpl: () => Promise.reject(new TypeError("Failed to fetch")),
    });
    const result = await adapter.fetchRecords("loans");
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("network");
    expect(result.error.message).toContain("Failed to fetch");
  });

  it("surfaces invalid JSON as typed invalid_payload", async () => {
    const adapter = createRestDataAdapter({
      baseUrl: "http://localhost:4000",
      fetchImpl: () =>
        Promise.resolve(
          new Response("not-json", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
    });
    const result = await adapter.fetchRecords("loans");
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("invalid_payload");
  });
});

describe("DataAdapter interface surface", () => {
  it("exposes only fetchRecords — no REST request types on the interface", () => {
    const adapter = createRestDataAdapter({
      baseUrl: "http://localhost:4000",
      fetchImpl: () =>
        Promise.resolve(
          new Response("[]", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
    });
    expect(Object.keys(adapter).sort()).toEqual(["fetchRecords"]);
    expect(typeof adapter.fetchRecords).toBe("function");
  });
});
