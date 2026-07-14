/**
 * Project {@link EffectivePermissions} onto layout columns for paint / edit.
 *
 * Hidden fields are omitted entirely (never painted). View / edit remain
 * in the projected list with their access mode. Callers pass the result
 * into the grid renderer’s column-mapped paint/edit path.
 */

import {
  canAccessRegion,
  canEditField,
  getFieldAccess,
  isFieldHidden,
  type EffectivePermissions,
  type FieldAccess,
} from "./permissions.js";
import type { LayoutColumn } from "./types.js";

/** A layout column that survived permission filtering (not hidden). */
export interface PermissionProjectedColumn {
  fieldId: string;
  name: string;
  type: LayoutColumn["type"];
  /** Original engine / layout column index (before hiding). */
  engineColIndex: number;
  /** Index in the painted (visible-only) column list. */
  paintColIndex: number;
  /** `view` or `edit` — never `hidden`. */
  access: Exclude<FieldAccess, "hidden">;
}

/** Result of projecting main (or Aggregate-synced) columns through permissions. */
export interface PermissionColumnProjection {
  columns: readonly PermissionProjectedColumn[];
  /** Engine col indices in paint order — feed to remapped grid sources. */
  engineColIndices: readonly number[];
  columnNames: readonly string[];
}

/**
 * Drop hidden fields and assign paint indices. Order matches the layout.
 */
export function projectColumnsForPermissions(
  columns: readonly LayoutColumn[],
  effective: EffectivePermissions,
): PermissionColumnProjection {
  const projected: PermissionProjectedColumn[] = [];
  for (const column of columns) {
    if (isFieldHidden(effective, column.fieldId)) {
      continue;
    }
    const access = getFieldAccess(effective, column.fieldId);
    if (access === "hidden") {
      continue;
    }
    const paintColIndex = projected.length;
    projected.push({
      fieldId: column.fieldId,
      name: column.name,
      type: column.type,
      engineColIndex: column.colIndex,
      paintColIndex,
      access,
    });
  }
  return {
    columns: projected,
    engineColIndices: projected.map((c) => c.engineColIndex),
    columnNames: projected.map((c) => c.name),
  };
}

/**
 * Look up projected column access by paint-column index.
 * Returns `undefined` when the paint index is out of range.
 */
export function accessForPaintColumn(
  projection: PermissionColumnProjection,
  paintCol: number,
): Exclude<FieldAccess, "hidden"> | undefined {
  return projection.columns[paintCol]?.access;
}

/**
 * Field id for a paint column, or `undefined` if out of range.
 */
export function fieldIdForPaintColumn(
  projection: PermissionColumnProjection,
  paintCol: number,
): string | undefined {
  return projection.columns[paintCol]?.fieldId;
}

/**
 * Attempt to authorize an edit for `fieldId`.
 *
 * Returns a clear denial reason instead of a silent no-op.
 */
export type FieldEditDecision =
  | { ok: true }
  | {
      ok: false;
      fieldId: string;
      access: FieldAccess;
      message: string;
    };

export function authorizeFieldEdit(
  effective: EffectivePermissions,
  fieldId: string,
): FieldEditDecision {
  const access = getFieldAccess(effective, fieldId);
  if (canEditField(effective, fieldId)) {
    return { ok: true };
  }
  if (access === "hidden") {
    return {
      ok: false,
      fieldId,
      access,
      message: `Cannot edit hidden field "${fieldId}".`,
    };
  }
  return {
    ok: false,
    fieldId,
    access,
    message: `Cannot edit "${fieldId}" — access is ${access}, not edit.`,
  };
}

/** Whether a region should be painted / interactive. */
export function isRegionVisible(
  effective: EffectivePermissions,
  regionId: string,
): boolean {
  return canAccessRegion(effective, regionId);
}
