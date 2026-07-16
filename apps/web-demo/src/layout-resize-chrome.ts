/**
 * Demo glue for layout resize / shared-layout reset, gated by resolved
 * {@link EffectivePermissions.layout} (same resolve → authorize pattern as
 * field edits).
 */

import {
  authorizeLayoutResize,
  authorizeModifySharedLayout,
  type EffectivePermissions,
} from "@gridyard/workspace-runtime";
import {
  resizeColumnWithPermission,
  type ColumnResizeResult,
} from "@gridyard/grid-renderer";

export type LayoutChromeDecision =
  | { ok: true; widths: number[] }
  | { ok: false; message: string };

/**
 * Attempt a column-width drag step using the resolved `canResize` flag.
 */
export function tryColumnResizeDrag(
  effective: EffectivePermissions,
  widths: readonly number[],
  col: number,
  deltaPx: number,
): LayoutChromeDecision {
  const resize = authorizeLayoutResize(effective);
  if (!resize.ok) {
    return { ok: false, message: resize.message };
  }
  const result: ColumnResizeResult = resizeColumnWithPermission(
    widths,
    col,
    deltaPx,
    true,
  );
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  return { ok: true, widths: result.widths };
}

/**
 * Reset column widths to the shared defaults. Requires
 * `canModifySharedLayout` (admin-only shared layout).
 */
export function tryResetSharedColumnWidths(
  effective: EffectivePermissions,
  defaultWidths: readonly number[],
): LayoutChromeDecision {
  const decision = authorizeModifySharedLayout(effective);
  if (!decision.ok) {
    return { ok: false, message: decision.message };
  }
  return { ok: true, widths: [...defaultWidths] };
}
