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
export {
  LOAN_REVIEW_PERMISSIONS,
  LOAN_REVIEW_SAMPLE_USERS,
  type SamplePermissionUser,
} from "./fixtures/loan-review-permissions.js";
export {
  buildFormView,
  formatFormValue,
  type FormFieldView,
  type FormSectionView,
  type FormView,
} from "./form.js";
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
  accessForPaintColumn,
  authorizeFieldEdit,
  fieldIdForPaintColumn,
  isRegionVisible,
  projectColumnsForPermissions,
  type FieldEditDecision,
  type PermissionColumnProjection,
  type PermissionProjectedColumn,
} from "./permission-ui.js";
export {
  createRestDataAdapter,
  type RestDataAdapterOptions,
} from "./rest-adapter.js";
export type {
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
