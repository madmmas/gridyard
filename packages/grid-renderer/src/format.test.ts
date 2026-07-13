import { describe, expect, it } from "vitest";

import { formatCellValue } from "./format.js";
import { asGridDataSource } from "./source.js";

describe("formatCellValue", () => {
  it.each([
    [{ type: "empty" as const }, ""],
    [{ type: "number" as const, value: 42 }, "42"],
    [{ type: "text" as const, value: "Ada" }, "Ada"],
    [{ type: "bool" as const, value: true }, "TRUE"],
    [{ type: "error" as const, kind: "Circular" }, "#CIRCULAR!"],
  ])("formats %j → %j", (value, text) => {
    expect(formatCellValue(value)).toBe(text);
  });
});

describe("asGridDataSource", () => {
  it("normalizes wasm-shaped get_cell payloads", () => {
    const source = asGridDataSource({
      get_cell(row: number, col: number): unknown {
        if (row === 0 && col === 0) return { type: "number", value: 10 };
        return { type: "empty" };
      },
    });
    expect(source.get_cell(0, 0)).toEqual({ type: "number", value: 10 });
    expect(source.get_cell(1, 0)).toEqual({ type: "empty" });
  });

  it("falls back to empty for malformed payloads", () => {
    const source = asGridDataSource({
      get_cell(): unknown {
        return { type: "number", value: "nope" };
      },
    });
    expect(source.get_cell(0, 0)).toEqual({ type: "empty" });
  });
});
