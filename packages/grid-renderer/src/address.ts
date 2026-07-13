/**
 * Converts a zero-based column index to A1-style letters (`0` → `A`, `26` → `AA`).
 */
export function colIndexToLetters(col: number): string {
  if (!Number.isInteger(col) || col < 0) {
    throw new RangeError(`column index must be a non-negative integer, got ${String(col)}`);
  }
  let n = col + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/**
 * One-based row label for the gutter (`0` → `"1"`).
 */
export function rowIndexToLabel(row: number): string {
  if (!Number.isInteger(row) || row < 0) {
    throw new RangeError(`row index must be a non-negative integer, got ${String(row)}`);
  }
  return String(row + 1);
}
