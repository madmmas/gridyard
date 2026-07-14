import { describe, expect, it, vi } from "vitest";

import { beginEdit, commitEdit, formulaBarText } from "./edit.js";
import { asRegionDataSource, asRegionEditableGrid } from "./region.js";
import type { CellJsValue } from "./types.js";

describe("asRegionEditableGrid", () => {
  it("routes set/get/get_input to the pinned region", () => {
    const setCell = vi.fn();
    const workspace = {
      get_cell: vi.fn(
        (region: string, row: number, col: number): CellJsValue => {
          if (region === "bottom" && row === 0 && col === 1) {
            return { type: "number", value: 42 };
          }
          return { type: "empty" };
        },
      ),
      get_input: vi.fn((region: string, row: number, col: number): string => {
        if (region === "bottom" && row === 0 && col === 1) {
          return "=SUM(main!B1:B3)";
        }
        return "";
      }),
      set_cell: setCell,
    };

    const bottom = asRegionEditableGrid(workspace, "bottom");
    expect(bottom.get_cell(0, 1)).toEqual({ type: "number", value: 42 });
    expect(formulaBarText(bottom, { row: 0, col: 1 })).toBe("=SUM(main!B1:B3)");

    const session = beginEdit({ row: 0, col: 1 }, "=main!A1");
    commitEdit(bottom, session);
    expect(setCell).toHaveBeenCalledWith("bottom", 0, 1, "=main!A1");
  });

  it("does not touch other regions when pinning main", () => {
    const setCell = vi.fn();
    const workspace = {
      get_cell: () => ({ type: "empty" as const }),
      get_input: () => "",
      set_cell: setCell,
    };
    const main = asRegionEditableGrid(workspace, "main");
    commitEdit(main, beginEdit({ row: 2, col: 0 }, "hello"));
    expect(setCell).toHaveBeenCalledWith("main", 2, 0, "hello");
  });
});

describe("asRegionDataSource", () => {
  it("reads only the pinned region for paint", () => {
    const workspace = {
      get_cell: (region: string, row: number, col: number): CellJsValue => {
        if (region === "main" && row === 0 && col === 0) {
          return { type: "text", value: "loan" };
        }
        return { type: "empty" };
      },
    };
    const source = asRegionDataSource(workspace, "main");
    expect(source.get_cell(0, 0)).toEqual({ type: "text", value: "loan" });
    expect(source.get_cell(1, 0)).toEqual({ type: "empty" });
  });
});
