/**
 * Declarative workspace definition types and the normalized layout
 * descriptor produced by the parser.
 *
 * Region model matches the current two-region layout in
 * `docs/04-layout-and-permission-engine-spec.md` (main + bottom with
 * Aggregate / Notes tabs). Permissions and data binding are out of scope.
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

/** Authoring-time workspace JSON shape. */
export interface WorkspaceDefinition {
  id: string;
  name: string;
  regions: {
    main: MainRegionDefinition;
    bottom: BottomRegionDefinition;
  };
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
