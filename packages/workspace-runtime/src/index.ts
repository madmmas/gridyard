// Layout engine, permission engine, workspace schema parser, and data
// binding adapters. See docs/03-workspace-schema-spec.md and
// docs/04-layout-and-permission-engine-spec.md.

export { LOAN_REVIEW_WORKSPACE } from "./fixtures/loan-review.js";
export { parseWorkspaceDefinition } from "./parse.js";
export type {
  AggregateTabDefinition,
  BottomRegionDefinition,
  FieldDefinition,
  FieldType,
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
