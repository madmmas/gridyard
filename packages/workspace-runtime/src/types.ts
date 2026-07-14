/**
 * Declarative workspace definition types and the normalized layout
 * descriptor produced by the parser.
 *
 * Region model matches the current two-region layout in
 * `docs/04-layout-and-permission-engine-spec.md` (main + bottom with
 * Aggregate / Notes tabs). Permission resolution lives in
 * `permissions.ts`; data binding in `binding.ts`.
 */

/** Supported field types for v0.1 workspace definitions. */
export type FieldType = "text" | "number" | "currency" | "status" | "boolean";

/** A column/field in the main grid or Notes tab. */
export interface FieldDefinition {
  /** Binding / data-object key (e.g. `borrower` on a loans row). */
  id: string;
  /** Human-readable name shown in the spreadsheet name row. */
  name: string;
  type: FieldType;
}

/**
 * Aggregate tab column locked to a main-region field.
 *
 * `syncedFromMain: true` is required in the type so the sync constraint
 * from docs/04 is structural, not only a runtime convention: Aggregate
 * columns cannot be free-form; they must point at a main field id.
 */
export interface SyncedAggregateColumnDefinition {
  readonly syncedFromMain: true;
  /** Must equal a `regions.main.fields[].id`. */
  fieldId: string;
}

export interface MainRegionDefinition {
  id: "main";
  /** Fixture / adapter collection name (e.g. `loans`). */
  dataSource: string;
  fields: FieldDefinition[];
}

export interface AggregateTabDefinition {
  id: "aggregate";
  columns: SyncedAggregateColumnDefinition[];
}

export interface NotesTabDefinition {
  id: "notes";
  fields: FieldDefinition[];
}

export interface BottomRegionDefinition {
  id: "bottom";
  tabs: {
    aggregate: AggregateTabDefinition;
    notes: NotesTabDefinition;
  };
  /** Which bottom tab is shown initially; defaults to `aggregate`. */
  activeTab?: "aggregate" | "notes";
}

/**
 * One labeled section in a record form (docs/04 form engine).
 * Field ids must reference `regions.main.fields`.
 */
export interface FormSectionDefinition {
  id: string;
  /** Section heading (e.g. "Customer Information"). */
  title: string;
  /** Main field ids shown in this section, in display order. */
  fieldIds: string[];
}

/**
 * Structured form over the same main fields the grid binds.
 * Optional: workspaces without a form still load as grids.
 */
export interface FormDefinition {
  sections: FormSectionDefinition[];
}

/** Authoring-time workspace JSON shape. */
export interface WorkspaceDefinition {
  id: string;
  name: string;
  regions: {
    main: MainRegionDefinition;
    bottom: BottomRegionDefinition;
  };
  /** Optional form layout; uses the same field defs as main. */
  form?: FormDefinition;
}

/** Resolved main-region column for consumers (renderer / binders). */
export interface LayoutColumn {
  fieldId: string;
  name: string;
  type: FieldType;
  /** Zero-based A1 column index. */
  colIndex: number;
}

/** Aggregate column: same identity as main, tagged as width/name-synced. */
export interface SyncedLayoutColumn extends LayoutColumn {
  readonly syncedFromMain: true;
}

/** Normalized form section ready for the form engine. */
export interface FormSectionLayout {
  id: string;
  title: string;
  /** Resolved main columns in section order. */
  fields: LayoutColumn[];
}

/** Normalized layout descriptor ready for the renderer / adapters. */
export interface WorkspaceLayout {
  id: string;
  name: string;
  main: {
    dataSource: string;
    columns: LayoutColumn[];
  };
  bottom: {
    aggregate: {
      columns: SyncedLayoutColumn[];
    };
    notes: {
      fields: FieldDefinition[];
    };
    activeTab: "aggregate" | "notes";
  };
  /** Present when the workspace definition included a form. */
  form?: {
    sections: FormSectionLayout[];
  };
}

/** One actionable validation failure. */
export interface WorkspaceSchemaError {
  /** Dot/bracket path into the input (e.g. `regions.main.fields[0].id`). */
  path: string;
  /** Stable machine-readable code. */
  code: string;
  /** Human-readable description of what's wrong. */
  message: string;
}

export type ParseWorkspaceResult =
  | { ok: true; layout: WorkspaceLayout }
  | { ok: false; errors: WorkspaceSchemaError[] };
