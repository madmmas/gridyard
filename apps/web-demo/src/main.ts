import {
  asGridDataSource,
  paintStaticGrid,
} from "@gridyard/grid-renderer";

import init, { create_grid } from "./wasm-pkg/gridyard_wasm.js";

async function main(): Promise<void> {
  const status = document.getElementById("status");
  const canvas = document.getElementById("grid");
  if (!(canvas instanceof HTMLCanvasElement) || status === null) {
    throw new Error("expected #grid canvas and #status");
  }
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    throw new Error("2d context unavailable");
  }

  await init();
  const grid = create_grid();

  // Loan-review-ish sheet; Status uses IF(days) so non-zero late days → Overdue.
  // (Comparison operators are not in the v0.1 parser yet.)
  const rows: Array<[string, string, string]> = [
    ["Ada Lovelace", "1200", "12"],
    ["Grace Hopper", "0", "0"],
    ["Alan Turing", "800", "4"],
  ];
  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r];
    if (row === undefined) {
      continue;
    }
    const [borrower, amount, days] = row;
    const rowNum = String(r + 1);
    grid.set_cell(r, 0, borrower);
    grid.set_cell(r, 1, amount);
    grid.set_cell(r, 3, days);
    grid.set_cell(r, 2, `=IF(D${rowNum},"Overdue","Active")`);
  }

  const paintOptions = {
    rows: 3,
    cols: 4,
    columnNames: ["Borrower", "Amount", "Status", "Days late"],
    columnWidths: [168, 90, 84, 90],
    numericColumns: new Set([1, 3]),
    source: asGridDataSource(grid),
  };

  const layout = paintStaticGrid(ctx, paintOptions);
  canvas.width = layout.totalWidth;
  canvas.height = layout.totalHeight;
  paintStaticGrid(ctx, paintOptions);

  status.textContent = `Ready — C1 (Status) = ${JSON.stringify(grid.get_cell(0, 2))}`;
}

main().catch((err: unknown) => {
  const status = document.getElementById("status");
  if (status !== null) {
    status.textContent = `Failed: ${String(err)}`;
  }
  console.error(err);
});
