/**
 * Form engine: project one bound record + workspace form layout into
 * sectioned field views, applying the same field permissions as the grid.
 *
 * Conditional fields, validation, and write-back are out of scope
 * (Batch 04 §20).
 */

import type { BoundCellValue, BoundRow } from "./binding.js";
import {
  getFieldAccess,
  isFieldHidden,
  type EffectivePermissions,
  type FieldAccess,
} from "./permissions.js";
import type { FieldType, WorkspaceLayout } from "./types.js";

/** One visible form field after permission filtering. */
export interface FormFieldView {
  fieldId: string;
  label: string;
  type: FieldType;
  value: BoundCellValue;
  /** `view` or `edit` — never `hidden` (those are omitted). */
  access: Exclude<FieldAccess, "hidden">;
}

/** One visually distinct form section. */
export interface FormSectionView {
  id: string;
  title: string;
  fields: FormFieldView[];
}

/** Ready-to-render form for a single record. */
export interface FormView {
  sections: FormSectionView[];
}

/**
 * Builds a sectioned form view from the workspace layout, one bound row,
 * and effective permissions.
 *
 * Uses the same field ids / values as the grid binding path. Returns
 * `null` when the layout has no form definition.
 */
export function buildFormView(
  layout: WorkspaceLayout,
  record: BoundRow,
  effective: EffectivePermissions,
): FormView | null {
  if (layout.form === undefined) {
    return null;
  }

  const sections: FormSectionView[] = [];
  for (const section of layout.form.sections) {
    const fields: FormFieldView[] = [];
    for (const column of section.fields) {
      if (isFieldHidden(effective, column.fieldId)) {
        continue;
      }
      const access = getFieldAccess(effective, column.fieldId);
      if (access === "hidden") {
        continue;
      }
      fields.push({
        fieldId: column.fieldId,
        label: column.name,
        type: column.type,
        value: record[column.fieldId] ?? null,
        access,
      });
    }
    // Keep empty sections out so a fully-hidden section disappears.
    if (fields.length > 0) {
      sections.push({
        id: section.id,
        title: section.title,
        fields,
      });
    }
  }

  return { sections };
}

/**
 * Formats a bound cell value for a form control display string.
 */
export function formatFormValue(value: BoundCellValue): string {
  if (value === null) {
    return "";
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  return String(value);
}
