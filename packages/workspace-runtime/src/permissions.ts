/**
 * Permission engine: four levels with layered inheritance.
 *
 * Levels (docs/04): workspace access, region access, field
 * (view / edit / hidden), and layout (resize / personalize /
 * modify shared layout). Inheritance is core → company →
 * department → user — each overlay only replaces what it
 * explicitly sets. Auth/identity and UI enforcement are out of scope.
 */

/** Per-field access mode. Distinct from region accessibility. */
export type FieldAccess = "view" | "edit" | "hidden";

/** Layout-level capabilities from docs/04. */
export interface LayoutPermissions {
  /** User may resize columns / panels. */
  canResize: boolean;
  /** User may personalize their own view. */
  canPersonalize: boolean;
  /** User may change the shared layout (typically admin-only). */
  canModifySharedLayout: boolean;
}

/**
 * Complete core baseline. Later layers are sparse overlays, so core
 * must supply a full set plus defaults for ids never mentioned.
 */
export interface PermissionBaseline {
  workspaceAccess: boolean;
  /** Used when a region id is absent from every layer's `regions` map. */
  defaultRegionAccess: boolean;
  /** Explicit region → accessible. Missing ids use `defaultRegionAccess`. */
  regions: Readonly<Record<string, boolean>>;
  /** Used when a field id is absent from every layer's `fields` map. */
  defaultFieldAccess: FieldAccess;
  /** Explicit field → access. Missing ids use `defaultFieldAccess`. */
  fields: Readonly<Record<string, FieldAccess>>;
  layout: LayoutPermissions;
}

/**
 * Sparse overlay. Only present keys replace the resolved value from
 * the layer below; omitted keys leave the inherited value intact.
 */
export interface PermissionOverride {
  workspaceAccess?: boolean;
  regions?: Readonly<Record<string, boolean>>;
  fields?: Readonly<Record<string, FieldAccess>>;
  layout?: Partial<LayoutPermissions>;
}

/** Layers already selected for a subject (after catalog lookup). */
export interface PermissionLayers {
  core: PermissionBaseline;
  company?: PermissionOverride;
  department?: PermissionOverride;
  user?: PermissionOverride;
}

/**
 * Subject's place in the hierarchy. Used to pick named overlays from
 * a {@link LayeredPermissionDefinition}; does not authenticate.
 */
export interface HierarchyPosition {
  companyId?: string;
  departmentId?: string;
  userId?: string;
}

/**
 * Core baseline plus named company / department / user overlays.
 * Resolution never forks the workspace definition — overrides stack.
 */
export interface LayeredPermissionDefinition {
  core: PermissionBaseline;
  companies?: Readonly<Record<string, PermissionOverride>>;
  departments?: Readonly<Record<string, PermissionOverride>>;
  users?: Readonly<Record<string, PermissionOverride>>;
}

/** Fully resolved permissions after applying the inheritance stack. */
export interface EffectivePermissions {
  workspaceAccess: boolean;
  defaultRegionAccess: boolean;
  regions: Readonly<Record<string, boolean>>;
  defaultFieldAccess: FieldAccess;
  fields: Readonly<Record<string, FieldAccess>>;
  layout: LayoutPermissions;
}

/**
 * Resolve effective permissions for a hierarchy position.
 *
 * Order: core, then company (if `companyId` matches), then department,
 * then user. Missing ids or catalog entries skip that layer.
 */
export function resolvePermissions(
  definition: LayeredPermissionDefinition,
  position: HierarchyPosition = {},
): EffectivePermissions {
  return mergePermissionLayers({
    core: definition.core,
    company: lookup(definition.companies, position.companyId),
    department: lookup(definition.departments, position.departmentId),
    user: lookup(definition.users, position.userId),
  });
}

/**
 * Merge an already-selected layer stack. Prefer
 * {@link resolvePermissions} when overlays are keyed by hierarchy id.
 */
export function mergePermissionLayers(
  layers: PermissionLayers,
): EffectivePermissions {
  let effective = baselineToEffective(layers.core);
  for (const overlay of [layers.company, layers.department, layers.user]) {
    if (overlay !== undefined) {
      effective = applyOverride(effective, overlay);
    }
  }
  return effective;
}

/** Workspace-level gate (distinct from region / field). */
export function canAccessWorkspace(effective: EffectivePermissions): boolean {
  return effective.workspaceAccess;
}

/**
 * Region-level access only. Does not consult workspace access or
 * field visibility — those are separate levels.
 */
export function canAccessRegion(
  effective: EffectivePermissions,
  regionId: string,
): boolean {
  if (Object.prototype.hasOwnProperty.call(effective.regions, regionId)) {
    return effective.regions[regionId] === true;
  }
  return effective.defaultRegionAccess;
}

/**
 * Field-level access (`view` / `edit` / `hidden`). Independent of
 * whether the containing region is accessible.
 */
export function getFieldAccess(
  effective: EffectivePermissions,
  fieldId: string,
): FieldAccess {
  if (Object.prototype.hasOwnProperty.call(effective.fields, fieldId)) {
    const access = effective.fields[fieldId];
    if (access !== undefined) {
      return access;
    }
  }
  return effective.defaultFieldAccess;
}

export function isFieldHidden(
  effective: EffectivePermissions,
  fieldId: string,
): boolean {
  return getFieldAccess(effective, fieldId) === "hidden";
}

export function canEditField(
  effective: EffectivePermissions,
  fieldId: string,
): boolean {
  return getFieldAccess(effective, fieldId) === "edit";
}

function lookup(
  table: Readonly<Record<string, PermissionOverride>> | undefined,
  id: string | undefined,
): PermissionOverride | undefined {
  if (id === undefined || table === undefined) {
    return undefined;
  }
  return table[id];
}

function baselineToEffective(core: PermissionBaseline): EffectivePermissions {
  return {
    workspaceAccess: core.workspaceAccess,
    defaultRegionAccess: core.defaultRegionAccess,
    regions: { ...core.regions },
    defaultFieldAccess: core.defaultFieldAccess,
    fields: { ...core.fields },
    layout: { ...core.layout },
  };
}

function applyOverride(
  base: EffectivePermissions,
  overlay: PermissionOverride,
): EffectivePermissions {
  return {
    workspaceAccess:
      overlay.workspaceAccess !== undefined
        ? overlay.workspaceAccess
        : base.workspaceAccess,
    defaultRegionAccess: base.defaultRegionAccess,
    regions:
      overlay.regions !== undefined
        ? { ...base.regions, ...overlay.regions }
        : base.regions,
    defaultFieldAccess: base.defaultFieldAccess,
    fields:
      overlay.fields !== undefined
        ? { ...base.fields, ...overlay.fields }
        : base.fields,
    layout:
      overlay.layout !== undefined
        ? { ...base.layout, ...overlay.layout }
        : base.layout,
  };
}
