import type {
  AggregateTabDefinition,
  BottomRegionDefinition,
  FieldDefinition,
  FieldType,
  FormDefinition,
  FormSectionDefinition,
  FormSectionLayout,
  LayoutColumn,
  MainRegionDefinition,
  NotesTabDefinition,
  ParseWorkspaceResult,
  SyncedAggregateColumnDefinition,
  SyncedLayoutColumn,
  WorkspaceDefinition,
  WorkspaceLayout,
  WorkspaceSchemaError,
} from "./types.js";

const FIELD_TYPES = new Set<FieldType>([
  "text",
  "number",
  "currency",
  "status",
  "boolean",
]);

/**
 * Parses and validates a declarative workspace definition into a
 * normalized {@link WorkspaceLayout}.
 *
 * Never throws for malformed input — returns `{ ok: false, errors }` with
 * specific paths. Unexpected programmer errors (e.g. called incorrectly)
 * are still allowed to surface as throws.
 */
export function parseWorkspaceDefinition(input: unknown): ParseWorkspaceResult {
  const errors: WorkspaceSchemaError[] = [];

  if (!isRecord(input)) {
    return {
      ok: false,
      errors: [
        {
          path: "",
          code: "not_object",
          message: "workspace definition must be a JSON object",
        },
      ],
    };
  }

  const id = requireString(input, "id", errors);
  const name = requireString(input, "name", errors);

  const regionsRaw = input["regions"];
  if (!isRecord(regionsRaw)) {
    errors.push({
      path: "regions",
      code: "missing_regions",
      message: "regions must be an object with main and bottom",
    });
    return { ok: false, errors };
  }

  for (const key of Object.keys(regionsRaw)) {
    if (key !== "main" && key !== "bottom") {
      errors.push({
        path: `regions.${key}`,
        code: "unknown_region",
        message: `unknown region "${key}"; only "main" and "bottom" are allowed`,
      });
    }
  }

  const main = parseMainRegion(regionsRaw["main"], errors);
  const bottom = parseBottomRegion(regionsRaw["bottom"], errors);
  const form =
    input["form"] === undefined
      ? undefined
      : parseFormDefinition(input["form"], errors);

  if (errors.length > 0 || main === null || bottom === null || id === null || name === null) {
    return { ok: false, errors };
  }

  validateAggregateSync(main, bottom, errors);
  if (form !== undefined && form !== null) {
    validateFormFields(main, form, errors);
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const definition: WorkspaceDefinition = {
    id,
    name,
    regions: { main, bottom },
    ...(form !== undefined && form !== null ? { form } : {}),
  };

  return { ok: true, layout: toLayout(definition) };
}

function parseMainRegion(
  raw: unknown,
  errors: WorkspaceSchemaError[],
): MainRegionDefinition | null {
  const path = "regions.main";
  if (raw === undefined) {
    errors.push({
      path,
      code: "missing_region",
      message: 'regions.main is required',
    });
    return null;
  }
  if (!isRecord(raw)) {
    errors.push({
      path,
      code: "invalid_region",
      message: "regions.main must be an object",
    });
    return null;
  }

  if (raw["id"] !== "main") {
    errors.push({
      path: `${path}.id`,
      code: "invalid_region_id",
      message: 'regions.main.id must be the literal "main"',
    });
  }

  const dataSource = requireStringAt(raw, `${path}.dataSource`, "dataSource", errors);
  const fields = parseFieldList(raw["fields"], `${path}.fields`, errors);

  if (dataSource === null || fields === null) {
    return null;
  }
  if (fields.length === 0) {
    errors.push({
      path: `${path}.fields`,
      code: "empty_fields",
      message: "regions.main.fields must contain at least one field",
    });
    return null;
  }

  assertUniqueFieldIds(fields, `${path}.fields`, errors);

  return { id: "main", dataSource, fields };
}

function parseBottomRegion(
  raw: unknown,
  errors: WorkspaceSchemaError[],
): BottomRegionDefinition | null {
  const path = "regions.bottom";
  if (raw === undefined) {
    errors.push({
      path,
      code: "missing_region",
      message: "regions.bottom is required",
    });
    return null;
  }
  if (!isRecord(raw)) {
    errors.push({
      path,
      code: "invalid_region",
      message: "regions.bottom must be an object",
    });
    return null;
  }

  if (raw["id"] !== "bottom") {
    errors.push({
      path: `${path}.id`,
      code: "invalid_region_id",
      message: 'regions.bottom.id must be the literal "bottom"',
    });
  }

  const tabsRaw = raw["tabs"];
  if (!isRecord(tabsRaw)) {
    errors.push({
      path: `${path}.tabs`,
      code: "missing_tabs",
      message: "regions.bottom.tabs must include aggregate and notes",
    });
    return null;
  }

  for (const key of Object.keys(tabsRaw)) {
    if (key !== "aggregate" && key !== "notes") {
      errors.push({
        path: `${path}.tabs.${key}`,
        code: "unknown_tab",
        message: `unknown bottom tab "${key}"; only "aggregate" and "notes" are allowed`,
      });
    }
  }

  const aggregate = parseAggregateTab(tabsRaw["aggregate"], errors);
  const notes = parseNotesTab(tabsRaw["notes"], errors);

  let activeTab: "aggregate" | "notes" | undefined;
  if (raw["activeTab"] !== undefined) {
    if (raw["activeTab"] === "aggregate" || raw["activeTab"] === "notes") {
      activeTab = raw["activeTab"];
    } else {
      errors.push({
        path: `${path}.activeTab`,
        code: "invalid_active_tab",
        message: 'activeTab must be "aggregate" or "notes"',
      });
    }
  }

  if (aggregate === null || notes === null) {
    return null;
  }

  return {
    id: "bottom",
    tabs: { aggregate, notes },
    ...(activeTab !== undefined ? { activeTab } : {}),
  };
}

function parseAggregateTab(
  raw: unknown,
  errors: WorkspaceSchemaError[],
): AggregateTabDefinition | null {
  const path = "regions.bottom.tabs.aggregate";
  if (raw === undefined) {
    errors.push({
      path,
      code: "missing_tab",
      message: "regions.bottom.tabs.aggregate is required",
    });
    return null;
  }
  if (!isRecord(raw)) {
    errors.push({
      path,
      code: "invalid_tab",
      message: "aggregate tab must be an object",
    });
    return null;
  }

  if (raw["id"] !== "aggregate") {
    errors.push({
      path: `${path}.id`,
      code: "invalid_tab_id",
      message: 'aggregate.id must be the literal "aggregate"',
    });
  }

  const columnsRaw = raw["columns"];
  if (!Array.isArray(columnsRaw)) {
    errors.push({
      path: `${path}.columns`,
      code: "missing_columns",
      message: "aggregate.columns must be an array of synced-from-main columns",
    });
    return null;
  }

  const columns: SyncedAggregateColumnDefinition[] = [];
  for (let i = 0; i < columnsRaw.length; i += 1) {
    const colPath = `${path}.columns[${String(i)}]`;
    const col: unknown = columnsRaw[i];
    if (!isRecord(col)) {
      errors.push({
        path: colPath,
        code: "invalid_column",
        message: "aggregate column must be an object",
      });
      continue;
    }
    if (col["syncedFromMain"] !== true) {
      errors.push({
        path: `${colPath}.syncedFromMain`,
        code: "missing_sync_flag",
        message:
          "aggregate columns must set syncedFromMain: true (docs/04 column sync)",
      });
    }
    const fieldId = requireStringAt(col, `${colPath}.fieldId`, "fieldId", errors);
    if (fieldId !== null && col["syncedFromMain"] === true) {
      columns.push({ syncedFromMain: true, fieldId });
    }
  }

  return { id: "aggregate", columns };
}

function parseNotesTab(
  raw: unknown,
  errors: WorkspaceSchemaError[],
): NotesTabDefinition | null {
  const path = "regions.bottom.tabs.notes";
  if (raw === undefined) {
    errors.push({
      path,
      code: "missing_tab",
      message: "regions.bottom.tabs.notes is required",
    });
    return null;
  }
  if (!isRecord(raw)) {
    errors.push({
      path,
      code: "invalid_tab",
      message: "notes tab must be an object",
    });
    return null;
  }

  if (raw["id"] !== "notes") {
    errors.push({
      path: `${path}.id`,
      code: "invalid_tab_id",
      message: 'notes.id must be the literal "notes"',
    });
  }

  const fields = parseFieldList(raw["fields"], `${path}.fields`, errors);
  if (fields === null) {
    return null;
  }
  assertUniqueFieldIds(fields, `${path}.fields`, errors);
  return { id: "notes", fields };
}

function parseFieldList(
  raw: unknown,
  path: string,
  errors: WorkspaceSchemaError[],
): FieldDefinition[] | null {
  if (!Array.isArray(raw)) {
    errors.push({
      path,
      code: "missing_fields",
      message: `${path} must be an array of field definitions`,
    });
    return null;
  }

  const fields: FieldDefinition[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const fieldPath = `${path}[${String(i)}]`;
    const item: unknown = raw[i];
    if (!isRecord(item)) {
      errors.push({
        path: fieldPath,
        code: "invalid_field",
        message: "field must be an object",
      });
      continue;
    }
    const id = requireStringAt(item, `${fieldPath}.id`, "id", errors);
    const name = requireStringAt(item, `${fieldPath}.name`, "name", errors);
    const typeRaw = item["type"];
    if (typeof typeRaw !== "string" || !FIELD_TYPES.has(typeRaw as FieldType)) {
      errors.push({
        path: `${fieldPath}.type`,
        code: "invalid_field_type",
        message: `type must be one of: ${[...FIELD_TYPES].join(", ")}`,
      });
      continue;
    }
    if (id !== null && name !== null) {
      fields.push({ id, name, type: typeRaw as FieldType });
    }
  }
  return fields;
}

/**
 * Aggregate columns must reference main fields 1:1 in the same order
 * (docs/04: same letters/names, column widths locked to main).
 */
function parseFormDefinition(
  raw: unknown,
  errors: WorkspaceSchemaError[],
): FormDefinition | null {
  const path = "form";
  if (!isRecord(raw)) {
    errors.push({
      path,
      code: "invalid_form",
      message: "form must be an object with sections",
    });
    return null;
  }

  const sectionsRaw = raw["sections"];
  if (!Array.isArray(sectionsRaw)) {
    errors.push({
      path: `${path}.sections`,
      code: "missing_sections",
      message: "form.sections must be an array of section definitions",
    });
    return null;
  }
  if (sectionsRaw.length === 0) {
    errors.push({
      path: `${path}.sections`,
      code: "empty_sections",
      message: "form.sections must contain at least one section",
    });
    return null;
  }

  const sections: FormSectionDefinition[] = [];
  for (let i = 0; i < sectionsRaw.length; i += 1) {
    const sectionPath = `${path}.sections[${String(i)}]`;
    const item: unknown = sectionsRaw[i];
    if (!isRecord(item)) {
      errors.push({
        path: sectionPath,
        code: "invalid_section",
        message: "form section must be an object",
      });
      continue;
    }
    const sectionId = requireStringAt(item, `${sectionPath}.id`, "id", errors);
    const title = requireStringAt(item, `${sectionPath}.title`, "title", errors);
    const fieldIdsRaw = item["fieldIds"];
    if (!Array.isArray(fieldIdsRaw)) {
      errors.push({
        path: `${sectionPath}.fieldIds`,
        code: "missing_field_ids",
        message: "section.fieldIds must be an array of main field ids",
      });
      continue;
    }
    if (fieldIdsRaw.length === 0) {
      errors.push({
        path: `${sectionPath}.fieldIds`,
        code: "empty_field_ids",
        message: "section.fieldIds must contain at least one field id",
      });
      continue;
    }
    const fieldIds: string[] = [];
    for (let j = 0; j < fieldIdsRaw.length; j += 1) {
      const idPath = `${sectionPath}.fieldIds[${String(j)}]`;
      const fieldId: unknown = fieldIdsRaw[j];
      if (typeof fieldId !== "string" || fieldId.trim() === "") {
        errors.push({
          path: idPath,
          code: "missing_string",
          message: `${idPath} must be a non-empty string`,
        });
        continue;
      }
      fieldIds.push(fieldId);
    }
    if (sectionId !== null && title !== null && fieldIds.length > 0) {
      sections.push({ id: sectionId, title, fieldIds });
    }
  }

  if (sections.length === 0) {
    return null;
  }
  return { sections };
}

function validateFormFields(
  main: MainRegionDefinition,
  form: FormDefinition,
  errors: WorkspaceSchemaError[],
): void {
  const mainIds = new Set(main.fields.map((f) => f.id));
  const seen = new Map<string, string>();
  for (let s = 0; s < form.sections.length; s += 1) {
    const section = form.sections[s];
    if (section === undefined) {
      continue;
    }
    for (let f = 0; f < section.fieldIds.length; f += 1) {
      const fieldId = section.fieldIds[f];
      if (fieldId === undefined) {
        continue;
      }
      const path = `form.sections[${String(s)}].fieldIds[${String(f)}]`;
      if (!mainIds.has(fieldId)) {
        errors.push({
          path,
          code: "unknown_form_field",
          message: `form field "${fieldId}" does not exist on regions.main.fields`,
        });
        continue;
      }
      const prev = seen.get(fieldId);
      if (prev !== undefined) {
        errors.push({
          path,
          code: "duplicate_form_field",
          message: `form field "${fieldId}" already appears in ${prev}`,
        });
      } else {
        seen.set(fieldId, path);
      }
    }
  }
}

function validateAggregateSync(
  main: MainRegionDefinition,
  bottom: BottomRegionDefinition,
  errors: WorkspaceSchemaError[],
): void {
  const agg = bottom.tabs.aggregate.columns;
  const mainFields = main.fields;

  if (agg.length !== mainFields.length) {
    errors.push({
      path: "regions.bottom.tabs.aggregate.columns",
      code: "sync_length_mismatch",
      message: `aggregate.columns length (${String(agg.length)}) must match main.fields length (${String(mainFields.length)}) for column sync`,
    });
  }

  const len = Math.min(agg.length, mainFields.length);
  for (let i = 0; i < len; i += 1) {
    const col = agg[i];
    const field = mainFields[i];
    if (col === undefined || field === undefined) {
      continue;
    }
    if (col.fieldId !== field.id) {
      errors.push({
        path: `regions.bottom.tabs.aggregate.columns[${String(i)}].fieldId`,
        code: "sync_field_mismatch",
        message: `expected fieldId "${field.id}" to match main.fields[${String(i)}].id for column sync, got "${col.fieldId}"`,
      });
    }
  }

  const mainIds = new Set(mainFields.map((f) => f.id));
  for (let i = 0; i < agg.length; i += 1) {
    const col = agg[i];
    if (col === undefined) {
      continue;
    }
    if (!mainIds.has(col.fieldId)) {
      errors.push({
        path: `regions.bottom.tabs.aggregate.columns[${String(i)}].fieldId`,
        code: "unknown_main_field",
        message: `fieldId "${col.fieldId}" does not exist on regions.main.fields`,
      });
    }
  }
}

function toLayout(definition: WorkspaceDefinition): WorkspaceLayout {
  const mainColumns: LayoutColumn[] = definition.regions.main.fields.map(
    (field, colIndex) => ({
      fieldId: field.id,
      name: field.name,
      type: field.type,
      colIndex,
    }),
  );

  const aggregateColumns: SyncedLayoutColumn[] = mainColumns.map((column) => ({
    ...column,
    syncedFromMain: true as const,
  }));

  const columnById = new Map(
    mainColumns.map((column) => [column.fieldId, column] as const),
  );

  let formSections: FormSectionLayout[] | undefined;
  if (definition.form !== undefined) {
    formSections = definition.form.sections.map((section) => ({
      id: section.id,
      title: section.title,
      fields: section.fieldIds.flatMap((fieldId) => {
        const column = columnById.get(fieldId);
        return column === undefined ? [] : [column];
      }),
    }));
  }

  return {
    id: definition.id,
    name: definition.name,
    main: {
      dataSource: definition.regions.main.dataSource,
      columns: mainColumns,
    },
    bottom: {
      aggregate: { columns: aggregateColumns },
      notes: { fields: definition.regions.bottom.tabs.notes.fields },
      activeTab: definition.regions.bottom.activeTab ?? "aggregate",
    },
    ...(formSections !== undefined ? { form: { sections: formSections } } : {}),
  };
}

function assertUniqueFieldIds(
  fields: FieldDefinition[],
  path: string,
  errors: WorkspaceSchemaError[],
): void {
  const seen = new Map<string, number>();
  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    if (field === undefined) {
      continue;
    }
    const prev = seen.get(field.id);
    if (prev !== undefined) {
      errors.push({
        path: `${path}[${String(i)}].id`,
        code: "duplicate_field_id",
        message: `duplicate field id "${field.id}" (also at ${path}[${String(prev)}])`,
      });
    } else {
      seen.set(field.id, i);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(
  obj: Record<string, unknown>,
  key: string,
  errors: WorkspaceSchemaError[],
): string | null {
  return requireStringAt(obj, key, key, errors);
}

function requireStringAt(
  obj: Record<string, unknown>,
  path: string,
  key: string,
  errors: WorkspaceSchemaError[],
): string | null {
  const value = obj[key];
  if (typeof value !== "string" || value.trim() === "") {
    errors.push({
      path,
      code: "missing_string",
      message: `${path} must be a non-empty string`,
    });
    return null;
  }
  return value;
}
