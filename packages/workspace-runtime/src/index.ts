// Layout engine, permission engine, workspace schema parser, and data
// binding adapters. See docs/03-workspace-schema-spec.md and
// docs/04-layout-and-permission-engine-spec.md.

export {
  loadMainGrid,
  type DataAdapter,
  type DataAdapterError,
  type DataAdapterErrorCode,
  type FetchRecordsResult,
  type LoadMainGridResult,
} from "./adapter.js";
export {
  bindRecordsToMainGrid,
  resolveBindingPath,
  type BindMainGridResult,
  type BindingError,
  type BindingErrorCode,
  type BoundCellValue,
  type BoundMainGrid,
  type BoundRow,
} from "./binding.js";
export { LOAN_REVIEW_WORKSPACE } from "./fixtures/loan-review.js";
export { parseWorkspaceDefinition } from "./parse.js";
export {
  canAccessRegion,
  canAccessWorkspace,
  canEditField,
  getFieldAccess,
  isFieldHidden,
  mergePermissionLayers,
  resolvePermissions,
  type EffectivePermissions,
  type FieldAccess,
  type HierarchyPosition,
  type LayeredPermissionDefinition,
  type LayoutPermissions,
  type PermissionBaseline,
  type PermissionLayers,
  type PermissionOverride,
} from "./permissions.js";
export {
  createRestDataAdapter,
  type RestDataAdapterOptions,
} from "./rest-adapter.js";
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
