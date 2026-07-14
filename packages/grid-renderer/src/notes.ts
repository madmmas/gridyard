/**
 * In-memory Notes tab rows — plain label/value pairs with no formulas,
 * column letters, or row gutter (docs/04 Notes exception).
 */

export interface NotesRow {
  label: string;
  value: string;
}

/** Creates a Notes row list (copies `seed` when provided). */
export function createNotesRows(seed: readonly NotesRow[] = []): NotesRow[] {
  return seed.map((row) => ({ label: row.label, value: row.value }));
}

/** Replaces fields on the row at `index`; out-of-range leaves the list unchanged. */
export function updateNotesRow(
  rows: readonly NotesRow[],
  index: number,
  patch: Partial<NotesRow>,
): NotesRow[] {
  if (index < 0 || index >= rows.length) {
    return [...rows];
  }
  return rows.map((row, i) =>
    i === index
      ? {
          label: patch.label ?? row.label,
          value: patch.value ?? row.value,
        }
      : { ...row },
  );
}

/** Appends a Notes row (defaults to empty label/value). */
export function addNotesRow(
  rows: readonly NotesRow[],
  row: NotesRow = { label: "", value: "" },
): NotesRow[] {
  return [...rows, { label: row.label, value: row.value }];
}
