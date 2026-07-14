import { describe, expect, it } from "vitest";

import { addNotesRow, createNotesRows, updateNotesRow } from "./notes.js";

describe("notes rows", () => {
  it("copies seed rows into a mutable in-memory list", () => {
    const seed = [{ label: "Approval policy", value: "policy.pdf" }];
    const rows = createNotesRows(seed);
    expect(rows).toEqual(seed);
    expect(rows).not.toBe(seed);
    const first = rows[0];
    expect(first).toBeDefined();
    if (first === undefined) {
      return;
    }
    first.label = "changed";
    expect(seed[0]?.label).toBe("Approval policy");
  });

  it("updates a row by index and ignores out-of-range", () => {
    const rows = createNotesRows([
      { label: "A", value: "1" },
      { label: "B", value: "2" },
    ]);
    expect(updateNotesRow(rows, 1, { value: "updated" })).toEqual([
      { label: "A", value: "1" },
      { label: "B", value: "updated" },
    ]);
    expect(updateNotesRow(rows, 9, { label: "X" })).toEqual(rows);
  });

  it("appends an empty row by default", () => {
    const rows = createNotesRows([{ label: "A", value: "1" }]);
    expect(addNotesRow(rows)).toEqual([
      { label: "A", value: "1" },
      { label: "", value: "" },
    ]);
  });
});
