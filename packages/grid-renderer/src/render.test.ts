import { describe, expect, it, vi } from "vitest";

import { paintStaticGrid } from "./render.js";
import type { CellJsValue, GridDataSource } from "./types.js";

function mockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
  } as unknown as CanvasRenderingContext2D;
}

describe("paintStaticGrid virtual viewport", () => {
  it("only reads cells in the visible row window", () => {
    const reads: Array<[number, number]> = [];
    const source: GridDataSource = {
      get_cell(row, col): CellJsValue {
        reads.push([row, col]);
        return { type: "number", value: row * 10 + col };
      },
    };

    const headerHeight = 22 + 30;
    const rowHeight = 34;
    const bodyRowsVisible = 5;
    const viewportHeight = headerHeight + bodyRowsVisible * rowHeight;
    // Scroll to row 100; overscan 2 → start 98.
    const scrollTop = 100 * rowHeight;

    const layout = paintStaticGrid(mockCtx(), {
      rows: 5000,
      cols: 2,
      columnNames: ["A", "B"],
      columnWidths: [80, 80],
      source,
      viewport: { scrollTop, height: viewportHeight, overscan: 2 },
    });

    // Full content layout still reports all rows (scroll spacer / hit-test).
    expect(layout.bodyHeight).toBe(5000 * rowHeight);
    expect(layout.totalHeight).toBe(headerHeight + 5000 * rowHeight);

    const rowsRead = new Set(reads.map(([r]) => r));
    expect(Math.min(...rowsRead)).toBe(98);
    expect(Math.max(...rowsRead)).toBeLessThan(120);
    expect(rowsRead.has(0)).toBe(false);
    expect(rowsRead.has(200)).toBe(false);
    // Two columns per visible row.
    expect(reads.length).toBe(rowsRead.size * 2);
  });
});
